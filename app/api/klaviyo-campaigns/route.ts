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

interface RawCampaign {
  id: string
  attributes: {
    name: string
    scheduled_at: string | null
    send_time: string | null
  }
}

interface CampaignRow {
  id: string
  name: string
  sentAt: string
  recipients: number | null
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  revenue: number | null
  placedOrderRate: number | null
}

interface MonthlyRow {
  month: string
  recipients: number
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  revenue: number
}

function pct(n: number, d: number): number | null {
  if (d === 0) return null
  return (n / d) * 100
}

function monthKey(dateStr: string): string {
  return dateStr.substring(0, 7)
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

  // ── 1. Fetch all campaigns for the year (paginated) ──────────
  const startDate = `${year}-01-01T00:00:00`
  const endDate   = `${year + 1}-01-01T00:00:00`
  const filter    = `and(equals(messages.channel,'email'),greater-or-equal(scheduled_at,${startDate}),less-than(scheduled_at,${endDate}))`

  const allCampaigns: RawCampaign[] = []
  let nextUrl: string | null =
    `https://a.klaviyo.com/api/campaigns/?filter=${encodeURIComponent(filter)}&include=campaign-messages`

  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl, { headers })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
    }
    const json = await res.json()
    const items: RawCampaign[] = json.data ?? []
    allCampaigns.push(...items)
    nextUrl = json.links?.next ?? null
  }

  if (allCampaigns.length === 0) {
    return NextResponse.json({ campaigns: [], monthly: [] })
  }

  // ── 2. Fetch campaign-values-reports in staggered batches ────
  const campaignIds = allCampaigns.map(c => c.id)

  // Klaviyo recommends batches of up to 100 campaign IDs per report call
  const BATCH_SIZE = 100
  const batches: string[][] = []
  for (let i = 0; i < campaignIds.length; i += BATCH_SIZE) {
    batches.push(campaignIds.slice(i, i + BATCH_SIZE))
  }

  const statsMap: Record<string, Record<string, number>> = {}

  await Promise.all(
    batches.map(async (batch, i) => {
      if (i > 0) await new Promise(r => setTimeout(r, i * STAGGER_MS))

      const body = JSON.stringify({
        data: {
          type: 'campaign-values-report',
          attributes: {
            timeframe: { start: startDate, end: endDate },
            campaign_ids: batch,
            conversion_metric_id: config.metrics.placedOrder,
          },
        },
      })

      try {
        const res = await fetchWithRetry(
          'https://a.klaviyo.com/api/campaign-values-reports/',
          { method: 'POST', headers, body },
        )
        if (!res.ok) {
          console.error(`campaign-values-reports batch ${i} failed: ${res.status}`)
          return
        }
        const json = await res.json()
        const results: Array<{ campaign_id: string; statistics: Record<string, number> }> =
          json.data?.attributes?.results ?? []
        for (const r of results) {
          statsMap[r.campaign_id] = r.statistics
        }
      } catch (err) {
        console.error(`campaign-values-reports batch ${i} error:`, err)
      }
    })
  )

  // ── 3. Assemble campaign rows ────────────────────────────────
  const campaigns: CampaignRow[] = allCampaigns.map(c => {
    const sentAt = c.attributes.scheduled_at ?? c.attributes.send_time ?? ''
    const stats  = statsMap[c.id] ?? {}

    const recipients  = stats.recipients_count   ?? null
    const opens       = stats.unique_opens        ?? null
    const clicks      = stats.unique_clicks       ?? null
    const unsubs      = stats.unsubscribed        ?? null
    const bounces     = stats.bounced             ?? null
    const rev         = stats.sum_revenue         ?? null
    const orders      = stats.placed_order_count  ?? null

    const delivered = (recipients !== null && bounces !== null) ? recipients - bounces : recipients

    return {
      id:              c.id,
      name:            c.attributes.name,
      sentAt,
      recipients,
      openRate:        pct(opens   ?? 0, delivered ?? 0),
      clickRate:       pct(clicks  ?? 0, delivered ?? 0),
      ctor:            pct(clicks  ?? 0, opens     ?? 0),
      unsubRate:       pct(unsubs  ?? 0, recipients ?? 0),
      bounceRate:      pct(bounces ?? 0, recipients ?? 0),
      revenue:         rev,
      placedOrderRate: pct(orders  ?? 0, recipients ?? 0),
    }
  })

  // ── 4. Aggregate into monthly rows ───────────────────────────
  const monthMap: Record<string, {
    recipients: number
    opens: number; clicks: number; unsubs: number; bounces: number
    delivered: number
    revenue: number
  }> = {}

  for (const c of campaigns) {
    if (!c.sentAt) continue
    const mk = monthKey(c.sentAt)
    if (!monthMap[mk]) {
      monthMap[mk] = { recipients: 0, opens: 0, clicks: 0, unsubs: 0, bounces: 0, delivered: 0, revenue: 0 }
    }
    const m = monthMap[mk]
    const rec = c.recipients ?? 0
    const stats = statsMap[c.id] ?? {}
    m.recipients += rec
    m.opens      += stats.unique_opens       ?? 0
    m.clicks     += stats.unique_clicks      ?? 0
    m.unsubs     += stats.unsubscribed       ?? 0
    m.bounces    += stats.bounced            ?? 0
    m.delivered  += rec - (stats.bounced ?? 0)
    m.revenue    += stats.sum_revenue        ?? 0
  }

  const monthly: MonthlyRow[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      recipients: m.recipients,
      openRate:   pct(m.opens,  m.delivered),
      clickRate:  pct(m.clicks, m.delivered),
      ctor:       pct(m.clicks, m.opens),
      unsubRate:  pct(m.unsubs, m.recipients),
      bounceRate: pct(m.bounces, m.recipients),
      revenue:    m.revenue,
    }))

  return NextResponse.json({ campaigns, monthly })
}
