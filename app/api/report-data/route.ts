import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchPerformanceData } from '@/lib/performance'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const month = searchParams.get('month') // e.g. "2026-05"

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

  const allMonths = brand.klaviyo_account
    ? await fetchPerformanceData(brand.klaviyo_account, year)
    : []

  const monthData = allMonths.find(m => m.month === month) ?? null

  const [prevYear, prevMonthNum] = month.split('-').map(Number)
  const prevMonthKey = prevMonthNum === 1
    ? `${prevYear - 1}-12`
    : `${prevYear}-${String(prevMonthNum - 1).padStart(2, '0')}`
  const prevMonthData = allMonths.find(m => m.month === prevMonthKey) ?? null

  const { data: costRow } = await supabase
    .from('brand_monthly_costs')
    .select('cost')
    .eq('brand_id', brandId)
    .eq('month', month)
    .single()
  const monthlyCost = costRow?.cost ?? brand.default_monthly_cost ?? null

  const nextMonthNum = prevMonthNum === 12 ? 1 : prevMonthNum + 1
  const nextYear = prevMonthNum === 12 ? prevYear + 1 : prevYear
  const nextMonthStr = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}`

  const { data: campaigns } = await supabase
    .from('campaign_sends')
    .select('name, sent_at, recipients, open_rate, click_rate, revenue')
    .eq('brand_id', brandId)
    .gte('sent_at', `${month}-01`)
    .lt('sent_at', `${nextMonthStr}-01`)
    .order('sent_at')

  const { data: journalEntries } = await supabase
    .from('flow_journal_entries')
    .select('flow_name, category, description, outcome, changed_at')
    .eq('brand_id', brandId)
    .gte('changed_at', `${month}-01`)
    .lte('changed_at', `${month}-31`)
    .order('changed_at')

  let blendedOpenRate: number | null = null
  let blendedClickRate: number | null = null
  let campaignRevenue: number | null = null
  let flowRevenue: number | null = null

  if (brand.klaviyo_account) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const [campRes, flowRes] = await Promise.all([
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
      ])

      if (campRes.ok) {
        const campData = await campRes.json()
        const campMonth = (campData.monthly ?? []).find((m: { month: string }) => m.month === month)
        if (campMonth) campaignRevenue = campMonth.revenue ?? null
      }

      if (flowRes.ok) {
        const flowData = await flowRes.json()
        const flowMonth = (flowData.monthly ?? []).find((m: { month: string }) => m.month === month)
        if (flowMonth) {
          flowRevenue = flowMonth.revenue ?? null
          const del = flowMonth.recipients ?? 0
          if (del > 0) {
            blendedOpenRate = flowMonth.openRate
            blendedClickRate = flowMonth.clickRate
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch blended data:', e)
    }
  }

  const roi = monthlyCost && monthData?.revenue && monthlyCost > 0
    ? monthData.revenue / monthlyCost
    : null

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name, color: brand.color, description: brand.description },
    month,
    monthData,
    prevMonthData,
    monthlyCost,
    roi,
    campaignRevenue,
    flowRevenue,
    blendedOpenRate,
    blendedClickRate,
    campaigns: campaigns ?? [],
    journalEntries: journalEntries ?? [],
  })
}
