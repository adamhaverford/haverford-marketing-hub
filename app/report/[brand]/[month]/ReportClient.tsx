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

interface CampaignRow {
  id: string
  name: string
  sentAt: string
  recipients: number | null
  openRate: number | null
  clickRate: number | null
  revenue: number | null
}

interface FlowRow {
  id: string
  name: string
  recipients: number | null
  openRate: number | null
  clickRate: number | null
  revenue: number | null
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
  campRows: CampaignRow[]
  flowRows: FlowRow[]
  journalEntries: { flow_name: string; category: string; description: string; outcome: string | null; changed_at: string }[]
}

export default function ReportClient({ brandId, month, brandColor }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [notes, setNotes] = useState<{ emails_published: string; flows_watching: string; key_focus: string }>({
    emails_published: '', flows_watching: '', key_focus: ''
  })
  const [isAuthed, setIsAuthed] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

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

      // Check auth first — determines whether to use live data or snapshot
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthed(!!user)

      if (!user) {
        // Public visitor: load snapshot from report-notes
        const res = await fetch(`/api/report-notes?brandId=${brandId}&month=${month}`)
        if (!res.ok) { setLoading(false); return }
        const { notes: existingNotes, snapshot, brand } = await res.json()
        if (existingNotes) {
          setNotes({
            emails_published: existingNotes.emails_published ?? '',
            flows_watching:   existingNotes.flows_watching ?? '',
            key_focus:        existingNotes.key_focus ?? '',
          })
        }
        if (snapshot) {
          setData({ ...snapshot, brandColor: brand?.color ?? brandColor })
        }
        setLoading(false)
        return
      }

      // Authenticated: fetch live Supabase data + Klaviyo
      const staticRes = await fetch(`/api/report-data-public?brandId=${brandId}&month=${month}`)
      if (!staticRes.ok) { setLoading(false); return }
      const { brand, monthlyCost, journalEntries, notes: existingNotes } = await staticRes.json()

      if (!brand?.klaviyo_account) { setLoading(false); return }

      if (existingNotes) {
        setNotes({
          emails_published: existingNotes.emails_published ?? '',
          flows_watching:   existingNotes.flows_watching ?? '',
          key_focus:        existingNotes.key_focus ?? '',
        })
      }

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

      function findMonth(d: Record<string, unknown>, target: string): MonthRow | null {
        return (d.monthly as MonthRow[] ?? []).find(r => r.month === target) ?? null
      }

      const campMonth     = findMonth(campData, month)
      const flowMonth     = findMonth(flowData, month)
      const prevCampMonth = findMonth(prevCampData, prevMonthKey)
      const prevFlowMonth = findMonth(prevFlowData, prevMonthKey)

      const campRows: CampaignRow[] = (campData.campaigns ?? []).filter((c: CampaignRow) => {
        if (!c.sentAt) return false
        return c.sentAt.startsWith(month)
      })

      const flowRows: FlowRow[] = [...(flowData.flows ?? [])]
        .filter((f: FlowRow) => (f.revenue ?? 0) > 0)
        .sort((a: FlowRow, b: FlowRow) => (b.revenue ?? 0) - (a.revenue ?? 0))
        .slice(0, 6)

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
        campRows,
        flowRows,
        journalEntries,
      })

      setLoading(false)
    }
    load()
  }, [brandId, month, year, prevMonthKey, brandColor])

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

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch('/api/report-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          month,
          emails_published: notes.emails_published,
          flows_watching: notes.flows_watching,
          key_focus: notes.key_focus,
          snapshot: data ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Failed to save notes:', err)
      } else {
        setNotesSaved(true)
        setTimeout(() => setNotesSaved(false), 2000)
      }
    } catch (e) {
      console.error('Save notes error:', e)
    } finally {
      setSavingNotes(false)
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
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

        {/* Revenue breakdown */}
        {(data.campaignRevenue != null || data.flowRevenue != null) && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Breakdown</h2>
            {(() => {
              const total = (data.campaignRevenue ?? 0) + (data.flowRevenue ?? 0)
              const flowPct = total > 0 ? ((data.flowRevenue ?? 0) / total) * 100 : 0
              const campPct = total > 0 ? ((data.campaignRevenue ?? 0) / total) * 100 : 0
              return (
                <div className="space-y-3">
                  <div className="h-3 rounded-full overflow-hidden bg-gray-100 flex">
                    <div className="h-full transition-all" style={{ width: `${campPct}%`, backgroundColor: color }} />
                    <div className="h-full transition-all bg-blue-400" style={{ width: `${flowPct}%` }} />
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-gray-500">Campaigns</span>
                      <span className="font-semibold text-gray-800">{fmtCurrency(data.campaignRevenue)}</span>
                      <span className="text-gray-400">({campPct.toFixed(0)}%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-400" />
                      <span className="text-gray-500">Flows</span>
                      <span className="font-semibold text-gray-800">{fmtCurrency(data.flowRevenue)}</span>
                      <span className="text-gray-400">({flowPct.toFixed(0)}%)</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Campaigns table */}
        {data.campRows.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Campaigns This Month</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">Campaign</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2 px-4">Sent</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2 px-4">Open Rate</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2 px-4">Click Rate</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.campRows.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-gray-800 max-w-xs truncate">{c.name}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{c.recipients?.toLocaleString() ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmtRate(c.openRate)}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmtRate(c.clickRate)}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{fmtCurrency(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top flows table */}
        {data.flowRows.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Top Flows by Revenue</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 pb-2 pr-4">Flow</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2 px-4">Recipients</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2 px-4">Open Rate</th>
                  <th className="text-right text-xs font-semibold text-gray-400 pb-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.flowRows.map((f, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-4 font-medium text-gray-800 max-w-xs truncate">{f.name}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{f.recipients?.toLocaleString() ?? '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-500">{fmtRate(f.openRate)}</td>
                    <td className="py-3 text-right font-semibold text-gray-800">{fmtCurrency(f.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Monthly Notes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Monthly Notes</h2>
            {isAuthed && (
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="text-xs font-medium px-3 py-1.5 rounded-lg text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: color }}
              >
                {savingNotes ? 'Saving...' : notesSaved ? '✓ Saved & Published' : 'Save & Publish'}
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">📧 Emails published this month</p>
              {isAuthed ? (
                <textarea
                  ref={el => { if (el) autoResize(el) }}
                  value={notes.emails_published}
                  onChange={e => { setNotes(prev => ({ ...prev, emails_published: e.target.value })); autoResize(e.target) }}
                  placeholder="e.g. Evergreen: Bird netting harvest protection · Newsletter: EOFY sale"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none text-gray-700 placeholder-gray-300 overflow-hidden"
                  style={{ minHeight: '80px' }}
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {notes.emails_published || <span className="text-gray-300 italic">No notes added</span>}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">👀 Flows on the watchlist</p>
              {isAuthed ? (
                <textarea
                  ref={el => { if (el) autoResize(el) }}
                  value={notes.flows_watching}
                  onChange={e => { setNotes(prev => ({ ...prev, flows_watching: e.target.value })); autoResize(e.target) }}
                  placeholder="e.g. 45 day post-purchase — unsub rate at 2.04%, reviewing content angle"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none text-gray-700 placeholder-gray-300 overflow-hidden"
                  style={{ minHeight: '80px' }}
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {notes.flows_watching || <span className="text-gray-300 italic">No notes added</span>}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">🎯 Key focus / next month</p>
              {isAuthed ? (
                <textarea
                  ref={el => { if (el) autoResize(el) }}
                  value={notes.key_focus}
                  onChange={e => { setNotes(prev => ({ ...prev, key_focus: e.target.value })); autoResize(e.target) }}
                  placeholder="e.g. Get campaigns back in market — flows strong but over-reliant on automation"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none text-gray-700 placeholder-gray-300 overflow-hidden"
                  style={{ minHeight: '80px' }}
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {notes.key_focus || <span className="text-gray-300 italic">No notes added</span>}
                </p>
              )}
            </div>
          </div>
        </div>

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
