import { NextRequest, NextResponse } from 'next/server'

const ACCOUNT_KEY_MAP: Record<string, string | undefined> = {
  'catnets-au':      process.env.KLAVIYO_API_KEY_CATNETS,
  'haverford':       process.env.KLAVIYO_API_KEY_HAVERFORD,
  'justprotools-au': process.env.KLAVIYO_API_KEY_JUSTPROTOOLS,
  'gutzbusta-au':    process.env.KLAVIYO_API_KEY_GUTZBUSTA,
}

export async function POST(req: NextRequest) {
  const { account, metricId, year, measurements = ['count'], by } = await req.json()

  const apiKey = ACCOUNT_KEY_MAP[account]
  if (!apiKey) {
    return NextResponse.json(
      { error: `No API key configured for account: ${account}. Add KLAVIYO_API_KEY_${account.toUpperCase().replace(/-/g, '_')} to your environment variables.` },
      { status: 400 },
    )
  }

  const filter = `greater-or-equal(datetime,${year}-01-01T00:00:00),less-than(datetime,${year + 1}-01-01T00:00:00)`

  const body = JSON.stringify({
    data: {
      type: 'metric-aggregate',
      attributes: {
        metric_id: metricId,
        interval: 'month',
        measurements,
        filter,
        ...(by !== undefined && { by: [by] }),
      },
    },
  })

  const headers = {
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'Content-Type': 'application/json',
    'revision': '2024-02-15',
  }

  let res = await fetch('https://a.klaviyo.com/api/metric-aggregates/', { method: 'POST', headers, body })

  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 1000))
    res = await fetch('https://a.klaviyo.com/api/metric-aggregates/', { method: 'POST', headers, body })
  }

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
