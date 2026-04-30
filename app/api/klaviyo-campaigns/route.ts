import { NextRequest, NextResponse } from 'next/server'
import { KLAVIYO_BRAND_CONFIG } from '@/lib/klaviyo-config'

const ACCOUNT_KEY_MAP: Record<string, string | undefined> = {
  'catnets-au':      process.env.KLAVIYO_API_KEY_CATNETS,
  'haverford':       process.env.KLAVIYO_API_KEY_HAVERFORD,
  'justprotools-au': process.env.KLAVIYO_API_KEY_JUSTPROTOOLS,
  'gutzbusta-au':    process.env.KLAVIYO_API_KEY_GUTZBUSTA,
}

const STAGGER_MS = 200

const CAMPAIGN_STATISTICS = [
  'opens_unique',
  'clicks_unique',
  'delivered',
  'bounced',
  'unsubscribes',
  'revenue_per_recipient',
  'conversion_rate',
  'spam_complaints',
]

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

function campaignFilter(ids: string[]): string {
  if (ids.length === 1) return `equals(campaign_id,"${ids[0]}")`
  return `any(campaign_id,[${ids.map(id => `"${id}"`).join(',')}])`
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
  const listFilter = `and(equals(messages.channel,'email'),greater-or-equal(scheduled_at,${startDate}),less-than(scheduled_at,${endDate}))`

  const allCampaigns: RawCampaign[] = []
  let nextUrl: string | null =
    `https://a.klaviyo.com/api/campaigns/?filter=${encodeURIComponent(listFilter)}&include=campaign-messages`

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
            filter: campaignFilter(batch),
            statistics: CAMPAIGN_STATISTICS,
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
        console.log('[campaigns] raw results[0]:', JSON.stringify(results[0], null, 2))
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
    const sentAt  = c.attributes.scheduled_at ?? c.attributes.send_time ?? ''
    const stats   = statsMap[c.id] ?? {}

    const delivered = stats.delivered               ?? null
    const bounces   = stats.bounced           ?? null
    const opens     = stats.opens_unique             ?? null
    const clicks    = stats.clicks_unique            ?? null
    const unsubs    = stats.unsubscribes      ?? null
    const revPPR    = stats.revenue_per_recipient    ?? null
    const orders    = stats.conversion_rate             ?? null
    // revenue_per_recipient × delivered = total revenue
    const rev        = (revPPR !== null && delivered !== null) ? revPPR * delivered : null
    // recipients = delivered + bounced (no explicit recipients stat)
    const recipients = (delivered !== null && bounces !== null) ? delivered + bounces : null

    return {
      id:              c.id,
      name:            c.attributes.name,
      sentAt,
      recipients,
      openRate:        pct(opens   ?? 0, delivered  ?? 0),
      clickRate:       pct(clicks  ?? 0, delivered  ?? 0),
      ctor:            pct(clicks  ?? 0, opens      ?? 0),
      unsubRate:       pct(unsubs  ?? 0, recipients ?? 0),
      bounceRate:      pct(bounces ?? 0, recipients ?? 0),
      revenue:         rev,
      placedOrderRate: pct(orders  ?? 0, recipients ?? 0),
    }
  })

  // ── 4. Aggregate into monthly rows ───────────────────────────
  const monthMap: Record<string, {
    recipients: number; opens: number; clicks: number
    unsubs: number; bounces: number; delivered: number; revenue: number
  }> = {}

  for (const c of campaigns) {
    if (!c.sentAt) continue
    const mk    = monthKey(c.sentAt)
    const stats = statsMap[c.id] ?? {}
    if (!monthMap[mk]) {
      monthMap[mk] = { recipients: 0, opens: 0, clicks: 0, unsubs: 0, bounces: 0, delivered: 0, revenue: 0 }
    }
    const m = monthMap[mk]
    const del     = stats.delivered            ?? 0
    m.delivered  += del
    m.bounces    += stats.bounced      ?? 0
    m.opens      += stats.opens_unique        ?? 0
    m.clicks     += stats.clicks_unique       ?? 0
    m.unsubs     += stats.unsubscribes ?? 0
    // revenue_per_recipient × delivered = total revenue for this campaign
    m.revenue    += (stats.revenue_per_recipient ?? 0) * del
    m.recipients  = m.delivered + m.bounces
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

// Diagnostic: returns raw Klaviyo response shapes for the first page of campaigns
// and the values-report for the first campaign only. No transformation.
// Usage: GET /api/klaviyo-campaigns?account=haverford&year=2026
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
  const listFilter = `and(equals(messages.channel,'email'),greater-or-equal(scheduled_at,${startDate}),less-than(scheduled_at,${endDate}))`

  // 1. First page of campaigns list
  const listRes = await fetchWithRetry(
    `https://a.klaviyo.com/api/campaigns/?filter=${encodeURIComponent(listFilter)}&include=campaign-messages`,
    { headers },
  )
  const listRaw = await listRes.json()

  if (!listRes.ok) {
    return NextResponse.json({ error: 'campaigns list failed', raw: listRaw }, { status: listRes.status })
  }

  // 2. Values-report for the first campaign only
  const firstId: string | undefined = listRaw.data?.[0]?.id
  let reportRaw: unknown = null
  if (firstId) {
    const reportRes = await fetchWithRetry(
      'https://a.klaviyo.com/api/campaign-values-reports/',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: {
            type: 'campaign-values-report',
            attributes: {
              timeframe: { start: startDate, end: endDate },
              filter: campaignFilter([firstId]),
              statistics: CAMPAIGN_STATISTICS,
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
    firstCampaignId: firstId ?? null,
    campaignsList: listRaw,
    valuesReport: reportRaw,
  })
}
