import { NextRequest, NextResponse } from 'next/server'
import { KLAVIYO_BRAND_CONFIG } from '@/lib/klaviyo-config'

const ACCOUNT_KEY_MAP: Record<string, string | undefined> = {
  'catnets-au':      process.env.KLAVIYO_API_KEY_CATNETS,
  'haverford':       process.env.KLAVIYO_API_KEY_HAVERFORD,
  'justprotools-au': process.env.KLAVIYO_API_KEY_JUSTPROTOOLS,
  'gutzbusta-au':    process.env.KLAVIYO_API_KEY_GUTZBUSTA,
}

const STAGGER_MS = 200

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

  // ── 1. Fetch all flows (paginated) ───────────────────────────
  const allFlows: RawFlow[] = []
  let nextUrl: string | null = 'https://a.klaviyo.com/api/flows/'

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

  // statsMap[flowId][month] = aggregated statistics for that flow in that month
  const statsMap: Record<string, Record<string, number>> = {}

  // monthlyStatsMap[month][stat] = sum across all flows
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
            flow_ids: batch,
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

        // Flow reports return results grouped by flow and date
        const results: Array<{
          flow_id: string
          date: string
          statistics: Record<string, number>
        }> = json.data?.attributes?.results ?? []

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
          const ms = monthlyStatsMap[mk]
          const rec     = r.statistics.recipients_count  ?? 0
          const bounces = r.statistics.bounced           ?? 0
          ms.recipients += rec
          ms.opens      += r.statistics.unique_opens     ?? 0
          ms.clicks     += r.statistics.unique_clicks    ?? 0
          ms.unsubs     += r.statistics.unsubscribed     ?? 0
          ms.bounces    += bounces
          ms.spam       += r.statistics.marked_as_spam   ?? 0
          ms.delivered  += rec - bounces
          ms.revenue    += r.statistics.sum_revenue      ?? 0
          ms.orders     += r.statistics.placed_order_count ?? 0
        }
      } catch (err) {
        console.error(`flow-values-reports batch ${i} error:`, err)
      }
    })
  )

  // ── 3. Assemble flow rows ────────────────────────────────────
  const flows: FlowRow[] = allFlows.map(f => {
    const stats = statsMap[f.id] ?? {}

    const recipients = stats.recipients_count    ?? null
    const opens      = stats.unique_opens        ?? null
    const clicks     = stats.unique_clicks       ?? null
    const unsubs     = stats.unsubscribed        ?? null
    const bounces    = stats.bounced             ?? null
    const spam       = stats.marked_as_spam      ?? null
    const rev        = stats.sum_revenue         ?? null
    const orders     = stats.placed_order_count  ?? null

    const delivered = (recipients !== null && bounces !== null) ? recipients - bounces : recipients

    return {
      id:               f.id,
      name:             f.attributes.name,
      recipients,
      openRate:         pct(opens   ?? 0, delivered ?? 0),
      clickRate:        pct(clicks  ?? 0, delivered ?? 0),
      ctor:             pct(clicks  ?? 0, opens     ?? 0),
      unsubRate:        pct(unsubs  ?? 0, recipients ?? 0),
      bounceRate:       pct(bounces ?? 0, recipients ?? 0),
      spamRate:         pct(spam    ?? 0, recipients ?? 0),
      revenue:          rev,
      placedOrderRate:  pct(orders  ?? 0, recipients ?? 0),
      placedOrderCount: orders,
      aov:              (orders !== null && orders > 0 && rev !== null) ? rev / orders : null,
    }
  })

  // ── 4. Assemble monthly rows ─────────────────────────────────
  const monthly: MonthlyRow[] = Object.entries(monthlyStatsMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      recipients:      m.recipients,
      openRate:        pct(m.opens,  m.delivered),
      clickRate:       pct(m.clicks, m.delivered),
      unsubRate:       pct(m.unsubs, m.recipients),
      bounceRate:      pct(m.bounces, m.recipients),
      spamRate:        pct(m.spam,   m.recipients),
      revenue:         m.revenue,
      placedOrderCount: m.orders,
      aov:             m.orders > 0 ? m.revenue / m.orders : null,
    }))

  return NextResponse.json({ flows, monthly })
}
