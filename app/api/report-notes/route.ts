import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const month = searchParams.get('month')
  if (!brandId || !month) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()

  const [notesResult, brandResult, costResult, journalResult] = await Promise.all([
    supabase
      .from('report_notes')
      .select('emails_published, flows_watching, key_focus, snapshot')
      .eq('brand_id', brandId)
      .eq('month', month)
      .limit(1),
    supabase
      .from('brands')
      .select('id, name, color, klaviyo_account, default_monthly_cost')
      .eq('id', brandId)
      .single(),
    supabase
      .from('brand_monthly_costs')
      .select('cost')
      .eq('brand_id', brandId)
      .eq('month', month)
      .limit(1),
    supabase
      .from('flow_journal_entries')
      .select('flow_name, category, description, outcome, changed_at')
      .eq('brand_id', brandId)
      .gte('changed_at', `${month}-01`)
      .lte('changed_at', `${month}-31`)
      .order('changed_at'),
  ])

  const row = Array.isArray(notesResult.data) && notesResult.data.length > 0 ? notesResult.data[0] : null
  const brand = brandResult.data ?? null
  const monthlyCost =
    (Array.isArray(costResult.data) && costResult.data[0]?.cost) ??
    brand?.default_monthly_cost ??
    null
  const journalEntries = journalResult.data ?? []

  return NextResponse.json({
    notes: row ? { emails_published: row.emails_published, flows_watching: row.flows_watching, key_focus: row.key_focus } : null,
    snapshot: row?.snapshot ?? null,
    brand,
    monthlyCost,
    journalEntries,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { brandId, month, emails_published, flows_watching, key_focus, snapshot } = body
  if (!brandId || !month) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('report_notes')
    .upsert({
      brand_id: brandId,
      month,
      emails_published: emails_published || null,
      flows_watching: flows_watching || null,
      key_focus: key_focus || null,
      snapshot: snapshot ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
