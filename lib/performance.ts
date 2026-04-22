import { KLAVIYO_BRAND_CONFIG } from './klaviyo-config'

export interface MonthData {
  month: string        // "2024-01"
  sent: number | null
  opened: number | null
  clicked: number | null
  spam: number | null
  bounced: number | null
  unsubscribed: number | null
  subscribed: number | null
  revenue: number | null
  // Derived rates (null if no sent data)
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  spamRate: number | null
}

// Parses the Klaviyo metric-aggregate API response into a month→value map
function parseKlaviyoResponse(json: unknown, measurement: string): Record<string, number> {
  const result: Record<string, number> = {}
  const attrs = (json as { data?: { attributes?: { dates?: string[]; data?: { measurements?: Record<string, number[]> }[] } } })?.data?.attributes
  if (!attrs) return result

  const dates: string[] = attrs.dates ?? []
  const entries = attrs.data ?? []

  for (const entry of entries) {
    const values: number[] = entry.measurements?.[measurement] ?? []
    dates.forEach((date, i) => {
      const monthKey = date.substring(0, 7) // "2024-01"
      result[monthKey] = (result[monthKey] ?? 0) + (values[i] ?? 0)
    })
  }

  return result
}

async function fetchMetric(
  account: string,
  metricId: string,
  year: number,
  measurements: string[] = ['count'],
): Promise<{ count: Record<string, number>; sumValue: Record<string, number> }> {
  const res = await fetch('/api/klaviyo-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, metricId, year, measurements }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  const json = await res.json()
  return {
    count:    parseKlaviyoResponse(json, 'count'),
    sumValue: parseKlaviyoResponse(json, 'sum_value'),
  }
}

function rate(numerator: number | null, denominator: number | null): number | null {
  if (denominator === null || denominator === 0 || numerator === null) return null
  return (numerator / denominator) * 100
}

export async function fetchPerformanceData(klaviyoAccount: string, year: number): Promise<MonthData[]> {
  const config = KLAVIYO_BRAND_CONFIG[klaviyoAccount]
  if (!config) throw new Error(`No Klaviyo config for account: ${klaviyoAccount}`)

  const { metrics } = config

  const [sent, opened, clicked, spam, bounced, unsubscribed, subscribed, orders] = await Promise.all([
    fetchMetric(klaviyoAccount, metrics.received,     year),
    fetchMetric(klaviyoAccount, metrics.opened,       year),
    fetchMetric(klaviyoAccount, metrics.clicked,      year),
    fetchMetric(klaviyoAccount, metrics.spam,         year),
    fetchMetric(klaviyoAccount, metrics.bounced,      year),
    fetchMetric(klaviyoAccount, metrics.unsubscribed, year),
    fetchMetric(klaviyoAccount, metrics.subscribed,   year),
    fetchMetric(klaviyoAccount, metrics.placedOrder,  year, ['count', 'sum_value']),
  ])

  const months: MonthData[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const s   = sent.count[key]        ?? null
    const o   = opened.count[key]      ?? null
    const cl  = clicked.count[key]     ?? null
    const sp  = spam.count[key]        ?? null
    const bo  = bounced.count[key]     ?? null
    const un  = unsubscribed.count[key] ?? null
    const su  = subscribed.count[key]  ?? null
    const re  = orders.sumValue[key]   ?? null

    // Treat 0-sent months as no data
    const sentVal = s === 0 ? null : s

    months.push({
      month:        key,
      sent:         sentVal,
      opened:       o,
      clicked:      cl,
      spam:         sp,
      bounced:      bo,
      unsubscribed: un,
      subscribed:   su,
      revenue:      re,
      openRate:     rate(o,  sentVal),
      clickRate:    rate(cl, sentVal),
      ctor:         rate(cl, o),
      unsubRate:    rate(un, sentVal),
      bounceRate:   rate(bo, sentVal),
      spamRate:     rate(sp, sentVal),
    })
  }

  return months
}

// ── Formatting helpers ────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthLabel(month: string): string {
  const [, m] = month.split('-')
  return MONTH_NAMES[parseInt(m, 10) - 1] ?? month
}

export function fmtRate(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}%`
}

export function fmtCount(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString()
}

export function fmtCurrency(v: number | null): string {
  if (v === null) return '—'
  return `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function spamColor(rate: number | null): string {
  if (rate === null) return 'text-gray-400'
  if (rate > 0.1)  return 'text-red-600'
  if (rate > 0.05) return 'text-amber-600'
  return 'text-green-600'
}

export function spamBg(rate: number | null): string {
  if (rate === null) return ''
  if (rate > 0.1)  return 'bg-red-50'
  if (rate > 0.05) return 'bg-amber-50'
  return ''
}
