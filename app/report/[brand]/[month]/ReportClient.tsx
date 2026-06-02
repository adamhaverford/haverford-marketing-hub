'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Share2, TrendingUp, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  brandId: string
  month: string
  brandColor: string
}

interface MonthRow {
  month: string
  recipients: number
  openRate: number | null
  clickRate: number | null
  unsubRate: number | null
  bounceRate: number | null
  spamRate: number | null
  revenue: number
}

interface ReportData {
  brandName: string
  brandColor: string
  month: string
  current: MonthRow | null
  prev: MonthRow | null
  campaignRevenue: number | null
  flowRevenue: number | null
  monthlyCost: number | null
  roi: number | null
  journalEntries: { flow_name: string; category: string; description: string; outcome: string | null; changed_at: string }[]
}

export default function ReportClient({ brandId, month, brandColor }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const year = parseInt(month.split('-')[0])
  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }, [month])

  const availableMonths = useMemo(() => {
    const months = []
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    let d = new Date(2026, 0, 1)
    while (d <= lastMonth) {
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return months.reverse()
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()

      const { data: brand } = await supabase
        .from('brands')
        .select('name, color, klaviyo_account, default_monthly_cost')
        .eq('id', brandId)
        .single()

      if (!brand?.klaviyo_account) {
        setLoading(false)
        return
      }

      const { data: costRow } = await supabase
        .from('brand_monthly_costs')
        .select('cost')
        .eq('brand_id', brandId)
        .eq('month', month)
        .maybeSingle()
      const monthlyCost = costRow?.cost ?? brand.default_monthly_cost ?? null

      const { data: journal } = await supabase
        .from('flow_journal_entries')
        .select('flow_name, category, description, outcome, changed_at')
        .eq('brand_id', brandId)
        .gte('changed_at', `${month}-01`)
        .lte('changed_at', `${month}-31`)
        .order('changed_at')

      const headers = { 'Content-Type': 'application/json' }
      const [campRes, flowRes, prevCampRes, prevFlowRes] = await Promise.allSettled([
        fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year, month }) }),
        fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year, month }) }),
        fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }) }),
        fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }) }),
      ])

      const campData    = campRes.status    === 'fulfilled' && campRes.value.ok    ? await campRes.value.json()    : {}
      const flowData    = flowRes.status    === 'fulfilled' && flowRes.value.ok    ? await flowRes.value.json()    : {}
      const prevCampData = prevCampRes.status === 'fulfilled' && prevCampRes.value.ok ? await prevCampRes.value.json() : {}
      const prevFlowData = prevFlowRes.status === 'fulfilled' && prevFlowRes.value.ok ? await prevFlowRes.value.json() : {}

      function findMonth(data: Record<string, unknown>, target: string): MonthRow | null {
        return (data.monthly as MonthRow[] ?? []).find(r => r.month === target) ?? null
      }

      const campMonth     = findMonth(campData, month)
      const flowMonth     = findMonth(flowData, month)
      const prevCampMonth = findMonth(prevCampData, prevMonthKey)
      const prevFlowMonth = findMonth(prevFlowData, prevMonthKey)

      function blend(camp: MonthRow | null, flow: MonthRow | null): MonthRow | null {
        if (!camp && !flow) return null
        const campDel  = camp?.recipients ?? 0
        const flowDel  = flow?.recipients ?? 0
        const totalDel = campDel + flowDel
        const campOpens  = campDel > 0 ? (camp!.openRate  ?? 0) * campDel / 100 : 0
        const flowOpens  = flowDel > 0 ? (flow!.openRate  ?? 0) * flowDel / 100 : 0
        const campClicks = campDel > 0 ? (camp!.clickRate ?? 0) * campDel / 100 : 0
        const flowClicks = flowDel > 0 ? (flow!.clickRate ?? 0) * flowDel / 100 : 0
        return {
          month:      camp?.month ?? flow?.month ?? '',
          recipients: totalDel,
          revenue:    (camp?.revenue ?? 0) + (flow?.revenue ?? 0),
          openRate:   totalDel > 0 ? (campOpens  + flowOpens)  / totalDel * 100 : null,
          clickRate:  totalDel > 0 ? (campClicks + flowClicks) / totalDel * 100 : null,
          unsubRate:  camp?.unsubRate  ?? flow?.unsubRate  ?? null,
          bounceRate: camp?.bounceRate ?? flow?.bounceRate ?? null,
          spamRate:   camp?.spamRate   ?? flow?.spamRate   ?? null,
        }
      }

      const current = blend(campMonth, flowMonth)
      const prev    = blend(prevCampMonth, prevFlowMonth)
      const roi = monthlyCost && current?.revenue && monthlyCost > 0
        ? current.revenue / monthlyCost : null

      setData({
        brandName:       brand.name,
        brandColor:      brand.color ?? brandColor,
        month,
        current,
        prev,
        campaignRevenue: campMonth?.revenue ?? null,
        flowRevenue:     flowMonth?.revenue ?? null,
        monthlyCost,
        roi,
        journalEntries:  journal ?? [],
      })
      setLoading(false)
    }
    load()
  }, [brandId, month, year, prevMonthKey])

  function fmtCurrency(v: number | null | undefined) {
    if (v == null) return '—'
    return `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  function fmtRate(v: number | null | undefined) {
    if (v == null) return '—'
    return `${v.toFixed(2)}%`
  }
  function trendIcon(cur: number | null | undefined, prv: number | null | undefined, higherBetter = true) {
    if (cur == null || prv == null) return null
    const up = cur > prv
    if (up === higherBetter) return <TrendingUp className="w-4 h-4 text-green-500" />
    return <TrendingDown className="w-4 h-4 text-red-500" />
  }
  function trendLabel(cur: number | null | undefined, prv: number | null | undefined) {
    if (cur == null || prv == null || prv === 0) return 'No prior data'
    const diff = ((cur - prv) / prv * 100).toFixed(1)
    const sign = cur >= prv ? '+' : ''
    return `${sign}${diff}% vs last month`
  }
  function monthLabel(m: string) {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1, 1)
      .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  }

  const color = data?.brandColor ?? brandColor

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: color }} />
        <p className="text-sm text-gray-500">Loading report…</p>
      </div>
    </div>
  )

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-500">Report data unavailable.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b-4" style={{ borderColor: color }}>
        <div className="max-w-4xl mx-auto px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{data.brandName}</span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900">{monthLabel(data.month)}</h1>
              <p className="text-sm text-gray-400 mt-1">Email Marketing Performance Report</p>
              <select
                value={month}
                onChange={e => router.push(`/report/${brandId}/${e.target.value}`)}
                className="mt-3 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none"
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                {copied ? 'Copied!' : 'Share link'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white rounded-xl hover:opacity-90 transition-colors"
                style={{ backgroundColor: color }}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">

        {/* Hero: Revenue + ROI */}
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-8">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Total Revenue</p>
            <p className="text-5xl font-bold text-gray-900 mb-2">{fmtCurrency(data.current?.revenue)}</p>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-4">
              {trendIcon(data.current?.revenue, data.prev?.revenue)}
              <span>{trendLabel(data.current?.revenue, data.prev?.revenue)}</span>
            </div>
            {(data.campaignRevenue != null || data.flowRevenue != null) && (
              <div className="pt-4 border-t border-gray-50 space-y-2">
                {data.campaignRevenue != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Campaigns</span>
                    <span className="font-medium">{fmtCurrency(data.campaignRevenue)}</span>
                  </div>
                )}
                {data.flowRevenue != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Flows</span>
                    <span className="font-medium">{fmtCurrency(data.flowRevenue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border-2 p-8" style={{ borderColor: color + '40', backgroundColor: color + '08' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>Klaviyo ROI</p>
            <p className="text-5xl font-bold text-gray-900 mb-2">
              {data.roi ? `${data.roi.toFixed(1)}x` : '—'}
            </p>
            <p className="text-sm text-gray-500">
              {data.monthlyCost ? `A$${data.monthlyCost.toLocaleString()} monthly cost` : 'No cost set'}
            </p>
            {data.roi && (
              <p className="text-sm text-gray-400 mt-2">Every $1 spent returned ${data.roi.toFixed(1)}</p>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Open Rate',   cur: data.current?.openRate,   prv: data.prev?.openRate,   good: true  },
            { label: 'Click Rate',  cur: data.current?.clickRate,  prv: data.prev?.clickRate,  good: true  },
            { label: 'Unsub Rate',  cur: data.current?.unsubRate,  prv: data.prev?.unsubRate,  good: false },
            { label: 'Bounce Rate', cur: data.current?.bounceRate, prv: data.prev?.bounceRate, good: false },
            { label: 'Spam Rate',   cur: data.current?.spamRate,   prv: data.prev?.spamRate,   good: false },
          ].map(m => (
            <div key={m.label} className="rounded-xl border border-gray-100 bg-white p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">{fmtRate(m.cur)}</p>
              <div className="flex items-center gap-1">
                {trendIcon(m.cur, m.prv, m.good)}
                <span className="text-xs text-gray-400">{trendLabel(m.cur, m.prv)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Flow journal */}
        {data.journalEntries.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Flow Changes This Month</h2>
            <div className="space-y-3">
              {data.journalEntries.map((e, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 flex-shrink-0 ${
                    e.outcome === 'improved' ? 'bg-green-100 text-green-700' :
                    e.outcome === 'worse'    ? 'bg-red-100 text-red-700' :
                                              'bg-gray-100 text-gray-500'
                  }`}>
                    {e.outcome ?? 'unscored'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{e.flow_name} <span className="text-gray-400 font-normal">· {e.category}</span></p>
                    <p className="text-sm text-gray-500">{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-6 flex items-center justify-between text-xs text-gray-400">
          <span>Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <a href="https://haverford-marketing-hub.vercel.app" className="hover:text-gray-600 no-print">
            Haverford Marketing Hub
          </a>
        </div>
      </div>
    </div>
  )
}
