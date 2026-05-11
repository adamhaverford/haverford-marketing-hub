import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CALENDAR_EVENTS } from '@/lib/calendar-seed-data'

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== 'seed123') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const { error, count } = await supabase
    .from('calendar_events')
    .insert(CALENDAR_EVENTS)
    .select('id', { count: 'exact', head: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ seeded: count ?? CALENDAR_EVENTS.length })
}
