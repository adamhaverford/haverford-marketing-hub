import { NextRequest, NextResponse } from 'next/server'
import { KLAVIYO_BRAND_CONFIG } from '@/lib/klaviyo-config'

const ACCOUNT_KEY_MAP: Record<string, string | undefined> = {
  'catnets-au':      process.env.KLAVIYO_API_KEY_CATNETS,
  'haverford':       process.env.KLAVIYO_API_KEY_HAVERFORD,
  'justprotools-au': process.env.KLAVIYO_API_KEY_JUSTPROTOOLS,
  'gutzbusta-au':    process.env.KLAVIYO_API_KEY_GUTZBUSTA,
}

const STAGGER_MS = 200

const FLOW_STATISTICS = [
  'opens_unique',
  'clicks_unique',
  'delivered',
  'bounced',
  'unsubscribes',
  'revenue_per_recipient',
  'conversion_rate',
  'spam_complaints',
]

const FLOWS_LIST_URL = `https://a.klaviyo.com/api/flows/?filter=${encodeURIComponent("equals(status,'live')")}`

function makeHeaders(apiKey: string) {
  return {
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    'revision': '2024-02-15',
  }
}

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let res = await fetch(url, options)
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1000))
    res = await fetch(url, options)
  }
  return res
}

function flowFilter(ids: string[]): string {
  if (ids.length === 1) return `equals(flow_id,"${ids[0]}")`
  return `contains-any(flow_id,[${ids.map(id => `"${id}"`).join(',')}])`
}

interface RawFlow {
  id: string
  attributes: { name: string }
}

interface FlowRow {
  id: string
  name: string
  recipients: number | null
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  spamRate: number | null
  revenue: number | null
  placedOrderRate: number | null
  placedOrderCount: number | null
  aov: number | null
}

interface MonthlyRow {
  month: string
  recipients: number
  openRate: number | null
  clickRate: number | null
  unsubRate: number | null
  bounceRate: number | null
  spamRate: number | null
  revenue: number
  placedOrderCount: number
  aov: number | null
}

function pct(n: number, d: number): number | null {
  if (d === 0) return null
  return (n / d) * 100
}

// Per-flow accumulated totals built from all matching result rows
interface FlowAccum {
  delivered:       number
  bounced:         number
  opens_unique:    number
  clicks_unique:   number
  unsubscribes:    number
  spam_complaints: number
  total_revenue:   number  // sum of (revenue_per_recipient * delivered) per row
  total_orders:    number  // sum of (conversion_rate * delivered) per row
}

export async function POST(req: NextRequest) {
  const { account, year } = await req.json()

  const apiKey = ACCOUNT_KEY_MAP[account]
  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key configured for account: ${account}.` },
      { status: 400 },
    )
  }

  const config = KLAVIYO_BRAND_CONFIG[account]
  if (!config) {
    return NextResponse.json({ error: `No brand config for account: ${account}.` }, { status: 400 })
  }

  const headers = makeHeaders(apiKey)

  // ── 1. Fetch all live flows (paginated) ──────────────────────
  const allFlows: RawFlow[] = []
  let nextUrl: string | null = FLOWS_LIST_URL

  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl, { headers })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    const json = await res.json()
    const items: RawFlow[] = json.data ?? []
    allFlows.push(...items)
    nextUrl = json.links?.next ?? null
  }

  if (allFlows.length === 0) {
    return NextResponse.json({ flows: [], monthly: [] })
  }

  // ── 2. Fetch flow-values-reports in staggered batches ────────
  const startDate = `${year}-01-01T00:00:00`
  const endDate   = `${year + 1}-01-01T00:00:00`

  const flowIds = allFlows.map(f => f.id)

  const BATCH_SIZE = 100
  const batches: string[][] = []
  for (let i = 0; i < flowIds.length; i += BATCH_SIZE) {
    batches.push(flowIds.slice(i, i + BATCH_SIZE))
  }

  // Results are grouped by { flow_id, send_channel, flow_message_id } — no date field.
  // Accumulate all rows sharing the same flow_id into a single totals object.
  const statsMap: Record<string, FlowAccum> = {}

  const batchErrors: string[] = []
  let totalResultEntries = 0

  await Promise.all(
    batches.map(async (batch, i) => {
      if (i > 0) await new Promise(r => setTimeout(r, i * STAGGER_MS))

      const body = JSON.stringify({
        data: {
          type: 'flow-values-report',
          attributes: {
            timeframe: { start: startDate, end: endDate },
            filter: flowFilter(batch),
            statistics: FLOW_STATISTICS,
            conversion_metric_id: config.metrics.placedOrder,
          },
        },
      })

      try {
        const res = await fetchWithRetry(
          'https://a.klaviyo.com/api/flow-values-reports/',
          { method: 'POST', headers, body },
        )
        if (!res.ok) {
          const errText = await res.text()
          console.error(`flow-values-reports batch ${i} failed (${res.status}):`, errText)
          batchErrors.push(`batch ${i} — HTTP ${res.status}: ${errText}`)
          return
        }
        const json = await res.json()

        const results: Array<{ flow_id: string; statistics: Record<string, number> }> =
          json.data?.attributes?.results ?? []
        console.log('[flows] raw results[0]:', JSON.stringify(results[0], null, 2))
        totalResultEntries += results.length

        for (const r of results) {
          if (!statsMap[r.flow_id]) {
            statsMap[r.flow_id] = {
              delivered: 0, bounced: 0, opens_unique: 0, clicks_unique: 0,
              unsubscribes: 0, spam_complaints: 0, total_revenue: 0, total_orders: 0,
            }
          }
          const acc = statsMap[r.flow_id]
          const del = r.statistics.delivered ?? 0
          acc.delivered       += del
          acc.bounced         += r.statistics.bounced           ?? 0
          acc.opens_unique    += r.statistics.opens_unique      ?? 0
          acc.clicks_unique   += r.statistics.clicks_unique     ?? 0
          acc.unsubscribes    += r.statistics.unsubscribes      ?? 0
          acc.spam_complaints += r.statistics.spam_complaints   ?? 0
          // revenue_per_recipient and conversion_rate are per-message rates;
          // multiply by delivered to get message-level totals before summing
          acc.total_revenue   += (r.statistics.revenue_per_recipient ?? 0) * del
          acc.total_orders    += (r.statistics.conversion_rate       ?? 0) * del
        }
      } catch (err) {
        console.error(`flow-values-reports batch ${i} error:`, err)
      }
    })
  )

  const statsMapKeys = Object.keys(statsMap)
  console.log('[flows] statsMap summary — totalResultEntries:', totalResultEntries, '| statsMap keys:', statsMapKeys, '| first entry:', statsMapKeys[0] ? JSON.stringify(statsMap[statsMapKeys[0]]) : 'none')

  // ── 3. Assemble flow rows ────────────────────────────────────
  const flows: FlowRow[] = allFlows.map(f => {
    const acc = statsMap[f.id]
    if (!acc || acc.delivered === 0) {
      return {
        id: f.id, name: f.attributes.name,
        recipients: null, openRate: null, clickRate: null, ctor: null,
        unsubRate: null, bounceRate: null, spamRate: null,
        revenue: null, placedOrderRate: null, placedOrderCount: null, aov: null,
      }
    }

    const { delivered, bounced, opens_unique, clicks_unique,
            unsubscribes, spam_complaints, total_revenue, total_orders } = acc

    const recipients      = delivered + bounced
    const placedOrderCount = Math.round(total_orders)
    const revenue         = total_revenue

    return {
      id:               f.id,
      name:             f.attributes.name,
      recipients,
      openRate:         pct(opens_unique,    delivered),
      clickRate:        pct(clicks_unique,   delivered),
      ctor:             pct(clicks_unique,   opens_unique),
      unsubRate:        pct(unsubscribes,    delivered),
      bounceRate:       pct(bounced,         delivered),
      spamRate:         pct(spam_complaints, delivered),
      revenue,
      placedOrderRate:  pct(placedOrderCount, recipients),
      placedOrderCount: placedOrderCount > 0 ? placedOrderCount : null,
      aov:              placedOrderCount > 0 ? revenue / placedOrderCount : null,
    }
  })

  // ── 4. Monthly data ──────────────────────────────────────────
  // flow-values-report results have no date grouping (grouped by flow_message_id),
  // so monthly breakdown is not available from this endpoint.
  const monthly: MonthlyRow[] = []

  return NextResponse.json({ flows, monthly, ...(batchErrors.length > 0 && { errors: batchErrors }) })
}

// Diagnostic: returns raw Klaviyo response shapes for the first page of live flows
// and the values-report for the first flow only. No transformation.
// Usage: GET /api/klaviyo-flows?account=haverford&year=2026
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const account = searchParams.get('account') ?? ''
  const year    = parseInt(searchParams.get('year') ?? '0', 10)

  const apiKey = ACCOUNT_KEY_MAP[account]
  if (!apiKey) {
    return NextResponse.json({ error: `No API key for account: ${account}` }, { status: 400 })
  }
  const config = KLAVIYO_BRAND_CONFIG[account]
  if (!config) {
    return NextResponse.json({ error: `No brand config for account: ${account}` }, { status: 400 })
  }

  const headers = makeHeaders(apiKey)
  const startDate = `${year}-01-01T00:00:00`
  const endDate   = `${year + 1}-01-01T00:00:00`

  // 1. First page of live flows list
  const listRes = await fetchWithRetry(FLOWS_LIST_URL, { headers })
  const listRaw = await listRes.json()

  if (!listRes.ok) {
    return NextResponse.json({ error: 'flows list failed', raw: listRaw }, { status: listRes.status })
  }

  // 2. Values-report for the first flow only
  const firstId: string | undefined = listRaw.data?.[0]?.id
  let reportRaw: unknown = null
  if (firstId) {
    const reportRes = await fetchWithRetry(
      'https://a.klaviyo.com/api/flow-values-reports/',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: {
            type: 'flow-values-report',
            attributes: {
              timeframe: { start: startDate, end: endDate },
              filter: flowFilter([firstId]),
              statistics: FLOW_STATISTICS,
              conversion_metric_id: config.metrics.placedOrder,
            },
          },
        }),
      },
    )
    reportRaw = await reportRes.json()
  }

  return NextResponse.json({
    _note: 'Raw Klaviyo responses — no transformation applied',
    firstFlowId: firstId ?? null,
    flowsList: listRaw,
    valuesReport: reportRaw,
  })
}
