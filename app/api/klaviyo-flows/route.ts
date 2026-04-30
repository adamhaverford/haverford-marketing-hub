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
  return `any(flow_id,[${ids.map(id => `"${id}"`).join(',')}])`
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

  const statsMap: Record<string, Record<string, number>> = {}

  const monthlyStatsMap: Record<string, {
    recipients: number; opens: number; clicks: number
    unsubs: number; bounces: number; spam: number
    delivered: number; revenue: number; orders: number
  }> = {}

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
          console.error(`flow-values-reports batch ${i} failed: ${res.status}`)
          return
        }
        const json = await res.json()

        const results: Array<{
          flow_id: string
          date: string
          statistics: Record<string, number>
        }> = json.data?.attributes?.results ?? []
        console.log('[flows] raw results[0]:', JSON.stringify(results[0], null, 2))
        for (const r of results) {
          // Aggregate per-flow totals
          if (!statsMap[r.flow_id]) statsMap[r.flow_id] = {}
          const fs = statsMap[r.flow_id]
          for (const [k, v] of Object.entries(r.statistics)) {
            fs[k] = (fs[k] ?? 0) + v
          }

          // Aggregate per-month totals
          const mk = r.date?.substring(0, 7) ?? ''
          if (!mk) continue
          if (!monthlyStatsMap[mk]) {
            monthlyStatsMap[mk] = {
              recipients: 0, opens: 0, clicks: 0, unsubs: 0,
              bounces: 0, spam: 0, delivered: 0, revenue: 0, orders: 0,
            }
          }
          const ms      = monthlyStatsMap[mk]
          const del     = r.statistics.delivered              ?? 0
          const bounces = r.statistics.bounced        ?? 0
          ms.delivered  += del
          ms.bounces    += bounces
          ms.recipients  = ms.delivered + ms.bounces
          ms.opens      += r.statistics.opens_unique          ?? 0
          ms.clicks     += r.statistics.clicks_unique         ?? 0
          ms.unsubs     += r.statistics.unsubscribes   ?? 0
          ms.spam       += r.statistics.spam_complaints       ?? 0
          // revenue_per_recipient × delivered = total revenue for this result row
          ms.revenue    += (r.statistics.revenue_per_recipient ?? 0) * del
          ms.orders     += r.statistics.conversion_rate          ?? 0
        }
      } catch (err) {
        console.error(`flow-values-reports batch ${i} error:`, err)
      }
    })
  )

  // ── 3. Assemble flow rows ────────────────────────────────────
  const flows: FlowRow[] = allFlows.map(f => {
    const stats = statsMap[f.id] ?? {}

    const delivered = stats.delivered               ?? null
    const bounces   = stats.bounced          ?? null
    const opens     = stats.opens_unique            ?? null
    const clicks    = stats.clicks_unique           ?? null
    const unsubs    = stats.unsubscribes     ?? null
    const spam      = stats.spam_complaints         ?? null
    const revPPR    = stats.revenue_per_recipient   ?? null
    const orders    = stats.conversion_rate            ?? null
    // revenue_per_recipient × delivered = total revenue
    const rev        = (revPPR !== null && delivered !== null) ? revPPR * delivered : null
    const recipients = (delivered !== null && bounces !== null) ? delivered + bounces : null

    return {
      id:               f.id,
      name:             f.attributes.name,
      recipients,
      openRate:         pct(opens   ?? 0, delivered   ?? 0),
      clickRate:        pct(clicks  ?? 0, delivered   ?? 0),
      ctor:             pct(clicks  ?? 0, opens       ?? 0),
      unsubRate:        pct(unsubs  ?? 0, recipients  ?? 0),
      bounceRate:       pct(bounces ?? 0, recipients  ?? 0),
      spamRate:         pct(spam    ?? 0, recipients  ?? 0),
      revenue:          rev,
      placedOrderRate:  pct(orders  ?? 0, recipients  ?? 0),
      placedOrderCount: orders,
      aov:              (orders !== null && orders > 0 && rev !== null) ? rev / orders : null,
    }
  })

  // ── 4. Assemble monthly rows ─────────────────────────────────
  const monthly: MonthlyRow[] = Object.entries(monthlyStatsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      recipients:       m.recipients,
      openRate:         pct(m.opens,  m.delivered),
      clickRate:        pct(m.clicks, m.delivered),
      unsubRate:        pct(m.unsubs, m.recipients),
      bounceRate:       pct(m.bounces, m.recipients),
      spamRate:         pct(m.spam,   m.recipients),
      revenue:          m.revenue,
      placedOrderCount: m.orders,
      aov:              m.orders > 0 ? m.revenue / m.orders : null,
    }))

  return NextResponse.json({ flows, monthly })
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
