import { KLAVIYO_BRAND_CONFIG } from './klaviyo-config'

export interface MonthData {
  month: string
  recipients: number | null   // delivered + bounced, from Reporting API
  netSubscribers: number | null
  revenue: number | null
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  spamRate: number | null
}

function parseKlaviyoResponse(json: unknown, measurement: string): Record<string, number> {
  const result: Record<string, number> = {}
  const attrs = (json as { data?: { attributes?: { dates?: string[]; data?: { measurements?: Record<string, number[]> }[] } } })?.data?.attributes
  if (!attrs) return result

  const dates: string[] = attrs.dates ?? []
  const entries = attrs.data ?? []

  for (const entry of entries) {
    const values: number[] = entry.measurements?.[measurement] ?? []
    dates.forEach((date, i) => {
      const monthKey = date.substring(0, 7)
      result[monthKey] = (result[monthKey] ?? 0) + (values[i] ?? 0)
    })
  }

  return result
}

export async function fetchPerformanceData(klaviyoAccount: string, year: number): Promise<MonthData[]> {
  const config = KLAVIYO_BRAND_CONFIG[klaviyoAccount]
  if (!config) throw new Error(`No Klaviyo config for account: ${klaviyoAccount}`)

  const headers = { 'Content-Type': 'application/json' }
  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)

  // Kick off all fetches simultaneously.
  // Flows: one call per month (matching Report page approach) so each request covers a
  // single-month timeframe. The full-year flow-series-report response can be paginated
  // for large accounts, and the flows route reads only the first page — meaning some
  // flows' monthly data gets dropped. Single-month calls have far fewer results and
  // fit in one page, matching what Klaviyo's UI and the Report page show.
  const campPromise  = fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: klaviyoAccount, year }) })
  const subPromise   = fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: JSON.stringify({ account: klaviyoAccount, metricId: config.metrics.subscribed,   year, measurements: ['count'] }) })
  const unsubPromise = fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: JSON.stringify({ account: klaviyoAccount, metricId: config.metrics.unsubscribed, year, measurements: ['count'] }) })
  const flowPromises = monthKeys.map(mk => fetch('/api/klaviyo-flows', { method: 'POST', headers, body: JSON.stringify({ account: klaviyoAccount, year, month: mk }) }))

  const [campResult, subResult, unsubResult] = await Promise.allSettled([campPromise, subPromise, unsubPromise])
  const flowResults = await Promise.allSettled(flowPromises)

  const campJson  = campResult.status  === 'fulfilled' && campResult.value.ok  ? await campResult.value.json()  : {}
  const subJson   = subResult.status   === 'fulfilled' && subResult.value?.ok  ? await subResult.value.json()   : null
  const unsubJson = unsubResult.status === 'fulfilled' && unsubResult.value?.ok ? await unsubResult.value.json() : null

  const subCounts   = parseKlaviyoResponse(subJson,   'count')
  const unsubCounts = parseKlaviyoResponse(unsubJson, 'count')

  // Blend monthly data from campaigns and flows by reconstructing raw counts
  // from rate × recipients, then re-deriving blended rates from combined totals.
  interface MonthAccum {
    recipients: number
    opens: number; clicks: number
    unsubs: number; bounces: number; spam: number
    revenue: number
  }

  const monthMap: Record<string, MonthAccum> = {}

  function absorb(entries: Array<{
    month: string; recipients: number
    openRate: number | null; clickRate: number | null
    unsubRate: number | null; bounceRate: number | null; spamRate?: number | null
    revenue: number
  }>) {
    for (const m of entries) {
      if (!monthMap[m.month]) {
        monthMap[m.month] = { recipients: 0, opens: 0, clicks: 0, unsubs: 0, bounces: 0, spam: 0, revenue: 0 }
      }
      const acc = monthMap[m.month]
      const r = m.recipients ?? 0
      acc.recipients += r
      acc.opens      += ((m.openRate   ?? 0) / 100) * r
      acc.clicks     += ((m.clickRate  ?? 0) / 100) * r
      acc.unsubs     += ((m.unsubRate  ?? 0) / 100) * r
      acc.bounces    += ((m.bounceRate ?? 0) / 100) * r
      acc.spam       += ((m.spamRate   ?? 0) / 100) * r
      acc.revenue    += m.revenue ?? 0
    }
  }

  absorb(campJson.monthly ?? [])

  // Absorb per-month flow data: find the matching monthly entry from each single-month call
  for (let i = 0; i < flowResults.length; i++) {
    const result = flowResults[i]
    const mk = monthKeys[i]
    if (result.status === 'fulfilled' && result.value.ok) {
      const json = await result.value.json()
      const entry = (json.monthly as Array<{
        month: string; recipients: number; openRate: number | null; clickRate: number | null
        unsubRate: number | null; bounceRate: number | null; spamRate: number | null; revenue: number
      }> ?? []).find(m => m.month === mk)
      if (entry) absorb([entry])
    }
  }

  console.log('[PERF] May campaigns raw:', JSON.stringify((campJson.monthly ?? []).find((m: {month: string}) => m.month === '2026-05')))
  console.log('[PERF] May flows raw (from monthMap):', JSON.stringify(monthMap['2026-05']))

  const months: MonthData[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const acc = monthMap[key]
    const sub   = subCounts[key]   ?? null
    const unsub = unsubCounts[key] ?? null

    const rawNetSubs = sub !== null && unsub !== null ? sub - unsub : null
    const netSubscribers = rawNetSubs === 0 ? null : rawNetSubs

    if (!acc || acc.recipients === 0) {
      months.push({
        month: key, recipients: null, revenue: null,
        openRate: null, clickRate: null, ctor: null,
        unsubRate: null, bounceRate: null, spamRate: null,
        netSubscribers,
      })
      continue
    }

    const { recipients, opens, clicks, unsubs, bounces, spam, revenue } = acc
    months.push({
      month: key,
      recipients,
      revenue:    revenue > 0 ? revenue : null,
      openRate:   recipients > 0 ? (opens   / recipients) * 100 : null,
      clickRate:  recipients > 0 ? (clicks  / recipients) * 100 : null,
      ctor:       opens > 0      ? (clicks  / opens)      * 100 : null,
      unsubRate:  recipients > 0 ? (unsubs  / recipients) * 100 : null,
      bounceRate: recipients > 0 ? (bounces / recipients) * 100 : null,
      spamRate:   recipients > 0 ? (spam    / recipients) * 100 : null,
      netSubscribers,
    })
  }

  console.log('[PERF] May blended result:', JSON.stringify(months.find(m => m.month === '2026-05')))

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
