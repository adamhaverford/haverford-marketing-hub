import { NextRequest, NextResponse } from 'next/server'
import { KLAVIYO_BRAND_CONFIG } from '@/lib/klaviyo-config'

export const maxDuration = 30

const ACCOUNT_KEY_MAP: Record<string, string | undefined> = {
  'catnets-au':      process.env.KLAVIYO_API_KEY_CATNETS,
  'haverford':       process.env.KLAVIYO_API_KEY_HAVERFORD,
  'justprotools-au': process.env.KLAVIYO_API_KEY_JUSTPROTOOLS,
  'gutzbusta-au':    process.env.KLAVIYO_API_KEY_GUTZBUSTA,
}

export async function POST(req: NextRequest) {
  const { account, year, month } = await req.json()

  const apiKey = ACCOUNT_KEY_MAP[account]
  const config = KLAVIYO_BRAND_CONFIG[account]
  if (!apiKey || !config) {
    return NextResponse.json({ error: 'Unknown account' }, { status: 400 })
  }

  const [y, m] = month.split('-').map(Number)
  const start = `${year}-${String(m).padStart(2, '0')}-01T00:00:00`
  const nextMonth = m === 12
    ? `${y + 1}-01-01T00:00:00`
    : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`
  const dateFilter = `greater-or-equal(datetime,${start}),less-than(datetime,${nextMonth})`

  const headers = {
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    'revision': '2024-02-15',
  }

  async function fetchMetric(metricId: string): Promise<number> {
    const body = JSON.stringify({
      data: {
        type: 'metric-aggregate',
        attributes: {
          metric_id: metricId,
          interval: 'month',
          measurements: ['count'],
          filter: dateFilter,
        },
      },
    })
    try {
      const res = await fetch('https://a.klaviyo.com/api/metric-aggregates/', { method: 'POST', headers, body })
      if (!res.ok) return 0
      const json = await res.json()
      const attrs = json?.data?.attributes
      if (!attrs) return 0
      const dates: string[] = attrs.dates ?? []
      const entries: { measurements?: { count?: number[] } }[] = attrs.data ?? []
      // Find the index of our target month in the dates array
      const monthIdx = dates.findIndex((d: string) => d.startsWith(month))
      if (monthIdx === -1) return 0
      // Sum across all entries for that month index
      return entries.reduce((sum, entry) => {
        return sum + (entry.measurements?.count?.[monthIdx] ?? 0)
      }, 0)
    } catch {
      return 0
    }
  }

  const unsubCount     = await fetchMetric(config.metrics.unsubscribed)
  await new Promise(r => setTimeout(r, 500))
  const bounceCount    = await fetchMetric(config.metrics.bounced)
  await new Promise(r => setTimeout(r, 500))
  const spamCount      = await fetchMetric(config.metrics.spam)
  await new Promise(r => setTimeout(r, 500))
  const deliveredCount = await fetchMetric(config.metrics.received)

  const unsubRate  = deliveredCount > 0 ? (unsubCount  / deliveredCount) * 100 : null
  const bounceRate = deliveredCount > 0 ? (bounceCount / deliveredCount) * 100 : null
  const spamRate   = deliveredCount > 0 ? (spamCount   / deliveredCount) * 100 : null

  return NextResponse.json({ unsubRate, bounceRate, spamRate, unsubCount, bounceCount, spamCount, deliveredCount })
}
