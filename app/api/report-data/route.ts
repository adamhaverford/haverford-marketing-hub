import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const month = searchParams.get('month')

  if (!brandId || !month) {
    return NextResponse.json({ error: 'Missing brandId or month' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color, description, klaviyo_account, default_monthly_cost')
    .eq('id', brandId)
    .single()

  if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 })

  const year = parseInt(month.split('-')[0])
  const [, prevMonthNum] = month.split('-').map(Number)
  const prevMonthKey = prevMonthNum === 1
    ? `${year - 1}-12`
    : `${year}-${String(prevMonthNum - 1).padStart(2, '0')}`

  // Monthly cost
  const { data: costRow } = await supabase
    .from('brand_monthly_costs')
    .select('cost')
    .eq('brand_id', brandId)
    .eq('month', month)
    .maybeSingle()
  const monthlyCost = costRow?.cost ?? brand.default_monthly_cost ?? null

  // Flow journal entries for the month
  const { data: journalEntries } = await supabase
    .from('flow_journal_entries')
    .select('flow_name, category, description, outcome, changed_at')
    .eq('brand_id', brandId)
    .gte('changed_at', `${month}-01`)
    .lte('changed_at', `${month}-31`)
    .order('changed_at')

  // Fetch campaign + flow monthly data in parallel
  let campaignMonthData: Record<string, number | null> | null = null
  let prevCampaignMonthData: Record<string, number | null> | null = null
  let flowMonthData: Record<string, number | null> | null = null
  let prevFlowMonthData: Record<string, number | null> | null = null

  if (brand.klaviyo_account) {
    const baseUrl = 'https://haverford-marketing-hub.vercel.app'

    const [campRes, flowRes, prevCampRes, prevFlowRes] = await Promise.allSettled([
      fetch(`${baseUrl}/api/klaviyo-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: brand.klaviyo_account, year, month }),
      }),
      fetch(`${baseUrl}/api/klaviyo-flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: brand.klaviyo_account, year, month }),
      }),
      fetch(`${baseUrl}/api/klaviyo-campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }),
      }),
      fetch(`${baseUrl}/api/klaviyo-flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }),
      }),
    ])

    if (campRes.status === 'fulfilled' && campRes.value.ok) {
      const d = await campRes.value.json()
      const m = (d.monthly ?? []).find((r: { month: string }) => r.month === month)
      if (m) campaignMonthData = m
    }
    if (flowRes.status === 'fulfilled' && flowRes.value.ok) {
      const d = await flowRes.value.json()
      const m = (d.monthly ?? []).find((r: { month: string }) => r.month === month)
      if (m) flowMonthData = m
    }
    if (prevCampRes.status === 'fulfilled' && prevCampRes.value.ok) {
      const d = await prevCampRes.value.json()
      const m = (d.monthly ?? []).find((r: { month: string }) => r.month === prevMonthKey)
      if (m) prevCampaignMonthData = m
    }
    if (prevFlowRes.status === 'fulfilled' && prevFlowRes.value.ok) {
      const d = await prevFlowRes.value.json()
      const m = (d.monthly ?? []).find((r: { month: string }) => r.month === prevMonthKey)
      if (m) prevFlowMonthData = m
    }
  }

  // Blend campaign + flow data
  function blend(camp: Record<string, number | null> | null, flow: Record<string, number | null> | null) {
    if (!camp && !flow) return null
    const campRev = (camp as { revenue?: number } | null)?.revenue ?? 0
    const flowRev = (flow as { revenue?: number } | null)?.revenue ?? 0
    const campDel = (camp as { recipients?: number } | null)?.recipients ?? 0
    const flowDel = (flow as { recipients?: number } | null)?.recipients ?? 0
    const totalDel = campDel + flowDel
    const campOpens = campDel > 0 ? ((camp as { openRate?: number } | null)?.openRate ?? 0) * campDel / 100 : 0
    const flowOpens = flowDel > 0 ? ((flow as { openRate?: number } | null)?.openRate ?? 0) * flowDel / 100 : 0
    const campClicks = campDel > 0 ? ((camp as { clickRate?: number } | null)?.clickRate ?? 0) * campDel / 100 : 0
    const flowClicks = flowDel > 0 ? ((flow as { clickRate?: number } | null)?.clickRate ?? 0) * flowDel / 100 : 0
    return {
      revenue: campRev + flowRev,
      recipients: totalDel,
      openRate: totalDel > 0 ? (campOpens + flowOpens) / totalDel * 100 : null,
      clickRate: totalDel > 0 ? (campClicks + flowClicks) / totalDel * 100 : null,
      unsubRate: (camp as { unsubRate?: number } | null)?.unsubRate ?? null,
      bounceRate: (camp as { bounceRate?: number } | null)?.bounceRate ?? null,
      spamRate: (camp as { spamRate?: number } | null)?.spamRate ?? null,
    }
  }

  const blended = blend(campaignMonthData, flowMonthData)
  const prevBlended = blend(prevCampaignMonthData, prevFlowMonthData)
  const roi = monthlyCost && blended?.revenue && monthlyCost > 0
    ? blended.revenue / monthlyCost
    : null

  console.log('[report-data]', brand.name, month, {
    revenue: blended?.revenue,
    roi,
    campRevenue: (campaignMonthData as { revenue?: number } | null)?.revenue,
    flowRevenue: (flowMonthData as { revenue?: number } | null)?.revenue,
  })

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name, color: brand.color, description: brand.description },
    month,
    monthData: blended,
    prevMonthData: prevBlended,
    monthlyCost,
    roi,
    campaignRevenue: (campaignMonthData as { revenue?: number } | null)?.revenue ?? null,
    flowRevenue: (flowMonthData as { revenue?: number } | null)?.revenue ?? null,
    journalEntries: journalEntries ?? [],
  })
}
