import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const month = searchParams.get('month')
  if (!brandId || !month) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('report_notes')
    .select('emails_published, flows_watching, key_focus')
    .eq('brand_id', brandId)
    .eq('month', month)
    .maybeSingle()

  return NextResponse.json(data ?? {})
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { brandId, month, emails_published, flows_watching, key_focus } = body
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'brand_id,month' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
