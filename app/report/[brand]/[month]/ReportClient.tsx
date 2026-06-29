'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Share2, TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { KLAVIYO_BRAND_CONFIG } from '@/lib/klaviyo-config'
import { YOY_STATIC_REVENUE } from '@/lib/yoy-revenue-static'

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
  netGrowth: number | null
  newSubscribers: number | null
  unsubscribes: number | null
  prevNetGrowth: number | null
  yoyRevenue: { year: number; months: { month: string; revenue: number }[] }[]
}

function parseMetricCount(json: unknown): Record<string, number> {
  const result: Record<string, number> = {}
  const attrs = (json as { data?: { attributes?: { dates?: string[]; data?: { measurements?: Record<string, number[]> }[] } } })?.data?.attributes
  if (!attrs) return result
  const dates: string[] = attrs.dates ?? []
  const entries: { measurements?: Record<string, number[]> }[] = attrs.data ?? []
  for (const entry of entries) {
    const values: number[] = entry.measurements?.count ?? []
    dates.forEach((date, i) => {
      const key = date.substring(0, 7)
      result[key] = (result[key] ?? 0) + (values[i] ?? 0)
    })
  }
  return result
}

function findMonth(d: Record<string, unknown>, target: string): MonthRow | null {
  return (d.monthly as MonthRow[] ?? []).find(r => r.month === target) ?? null
}

function blend(camp: MonthRow | null, flow: MonthRow | null): MonthRow | null {
  if (!camp && !flow) return null
  const campDel  = camp?.recipients ?? 0
  const flowDel  = flow?.recipients ?? 0
  const totalDel = campDel + flowDel
  const campOpens  = campDel > 0 ? (camp!.openRate  ?? 0) * campDel / 100 : 0
  const flowOpens  = flowDel > 0 ? (flow!.openRate  ?? 0) * flowDel / 100 : 0
  const campClicks = campDel > 0 ? (camp!.clickRate ?? 0) * campDel / 100 : 0
  const flowClicks = flowDel > 0 ? (flow!.clickRate ?? 0) * flowDel / 100 : 0
  const campUnsubs  = campDel > 0 ? (camp!.unsubRate  ?? 0) * campDel / 100 : 0
  const flowUnsubs  = flowDel > 0 ? (flow!.unsubRate  ?? 0) * flowDel / 100 : 0
  const campBounces = campDel > 0 ? (camp!.bounceRate ?? 0) * campDel / 100 : 0
  const flowBounces = flowDel > 0 ? (flow!.bounceRate ?? 0) * flowDel / 100 : 0
  const campSpam    = campDel > 0 ? (camp!.spamRate   ?? 0) * campDel / 100 : 0
  const flowSpam    = flowDel > 0 ? (flow!.spamRate   ?? 0) * flowDel / 100 : 0
  return {
    month:      camp?.month ?? flow?.month ?? '',
    recipients: totalDel,
    revenue:    (camp?.revenue ?? 0) + (flow?.revenue ?? 0),
    openRate:   totalDel > 0 ? (campOpens  + flowOpens)  / totalDel * 100 : null,
    clickRate:  totalDel > 0 ? (campClicks + flowClicks) / totalDel * 100 : null,
    unsubRate:  totalDel > 0 ? (campUnsubs  + flowUnsubs)  / totalDel * 100 : null,
    bounceRate: totalDel > 0 ? (campBounces + flowBounces) / totalDel * 100 : null,
    spamRate:   totalDel > 0 ? (campSpam    + flowSpam)    / totalDel * 100 : null,
  }
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null)

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

      // Always load snapshot first for everyone
      const res = await fetch(`/api/report-notes?brandId=${brandId}&month=${month}`)
      if (!res.ok) { setLoading(false); return }
      const { notes: existingNotes, snapshot, brand, journalEntries } = await res.json()

      if (existingNotes) {
        setNotes({
          emails_published: existingNotes.emails_published ?? '',
          flows_watching:   existingNotes.flows_watching ?? '',
          key_focus:        existingNotes.key_focus ?? '',
        })
      }

      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthed(!!user)

      if (snapshot && brand) {
        setData({
          ...snapshot,
          brandColor: brand?.color ?? brandColor,
          yoyRevenue: snapshot.yoyRevenue ?? [],
          journalEntries: journalEntries ?? snapshot.journalEntries ?? [],
        })
        setSnapshotDate(existingNotes?.updated_at ?? null)
        setLoading(false)

        // Background: fetch current-year revenue live and merge with snapshotted
        // historical data so the YoY chart is always up to date without re-fetching
        // all past years on every page load.
        if (brand?.klaviyo_account) {
          const headers = { 'Content-Type': 'application/json' }
          const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
          const [campResult, ...flowResults] = await Promise.allSettled([
            fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year }) }),
            ...monthKeys.map((mk: string) => fetch('/api/klaviyo-flows', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year, month: mk }) })),
          ])
          const campD = campResult.status === 'fulfilled' && campResult.value.ok ? await campResult.value.json() : {}
          const campMonthly: { month: string; revenue: number }[] = campD.monthly ?? []
          const monthMap: Record<string, number> = {}
          for (const m of campMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
          for (const flowR of flowResults) {
            if (flowR.status === 'fulfilled' && flowR.value.ok) {
              const flowD = await flowR.value.json()
              const flowMonthly: { month: string; revenue: number }[] = flowD.monthly ?? []
              for (const m of flowMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
            }
          }
          const liveEntry = {
            year,
            months: Object.entries(monthMap)
              .map(([m, revenue]) => ({ month: m, revenue }))
              .sort((a, b) => a.month.localeCompare(b.month)),
          }
          setData(prev => {
            if (!prev) return prev
            const staticRows = YOY_STATIC_REVENUE[brand.klaviyo_account]
            let pastEntries: ReportData['yoyRevenue']
            if (staticRows) {
              const byYear: Record<number, { month: string; revenue: number }[]> = {}
              for (const row of staticRows) {
                const y = parseInt(row.month.split('-')[0], 10)
                if (y < year) {
                  if (!byYear[y]) byYear[y] = []
                  byYear[y].push(row)
                }
              }
              pastEntries = Object.entries(byYear).map(([y, months]) => ({
                year: parseInt(y, 10),
                months: months.sort((a, b) => a.month.localeCompare(b.month)),
              }))
            } else {
              pastEntries = (snapshot.yoyRevenue ?? []).filter((e: { year: number }) => e.year !== year)
            }
            const merged = [...pastEntries, liveEntry].sort((a: { year: number }, b: { year: number }) => a.year - b.year)
            console.log('[load] yoyRevenue after merge:', JSON.stringify(merged.map(e => ({ year: e.year, months: e.months.length }))))
            return { ...prev, yoyRevenue: merged }
          })
        }
        return
      }

      setLoading(false)
    }
    load()
  }, [brandId, month, brandColor])

  async function refresh() {
    if (!isAuthed) return
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/report-notes?brandId=${brandId}&month=${month}`)
      if (!res.ok) return
      const { brand, monthlyCost, journalEntries } = await res.json()
      if (!brand?.klaviyo_account) return

      const headers = { 'Content-Type': 'application/json' }
      const [campRes, flowRes, prevCampRes, prevFlowRes] = await Promise.allSettled([
        fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year, month }) }),
        fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year, month }) }),
        fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }) }),
        fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(prevMonthKey.split('-')[0]), month: prevMonthKey }) }),
      ])

      const campData     = campRes.status     === 'fulfilled' && campRes.value.ok     ? await campRes.value.json()     : {}
      const flowData     = flowRes.status     === 'fulfilled' && flowRes.value.ok     ? await flowRes.value.json()     : {}
      const prevCampData = prevCampRes.status === 'fulfilled' && prevCampRes.value.ok ? await prevCampRes.value.json() : {}
      const prevFlowData = prevFlowRes.status === 'fulfilled' && prevFlowRes.value.ok ? await prevFlowRes.value.json() : {}

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

      const current = blend(campMonth, flowMonth)
      const prev    = blend(prevCampMonth, prevFlowMonth)
      const roi = monthlyCost && current?.revenue && monthlyCost > 0
        ? current.revenue / monthlyCost : null

      // Net subscriber growth
      let netGrowth: number | null = null
      let newSubscribers: number | null = null
      let unsubscribes: number | null = null
      let prevNetGrowth: number | null = null
      const brandMetrics = KLAVIYO_BRAND_CONFIG[brand.klaviyo_account]?.metrics
      if (brandMetrics) {
        const prevYear = parseInt(prevMonthKey.split('-')[0])
        const needsPrevYear = prevYear !== year
        const mkBody = (metricId: string, y: number) =>
          JSON.stringify({ account: brand.klaviyo_account, metricId, year: y, measurements: ['count'] })
        const [subCurRes, unsubCurRes, subPrevRes, unsubPrevRes] = await Promise.allSettled([
          fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: mkBody(brandMetrics.subscribed, year) }),
          fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: mkBody(brandMetrics.unsubscribed, year) }),
          needsPrevYear ? fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: mkBody(brandMetrics.subscribed, prevYear) }) : Promise.resolve(null),
          needsPrevYear ? fetch('/api/klaviyo-metrics', { method: 'POST', headers, body: mkBody(brandMetrics.unsubscribed, prevYear) }) : Promise.resolve(null),
        ])
        const subCurJson    = subCurRes.status   === 'fulfilled' && subCurRes.value?.ok   ? await subCurRes.value.json()   : null
        const unsubCurJson  = unsubCurRes.status  === 'fulfilled' && unsubCurRes.value?.ok ? await unsubCurRes.value.json() : null
        const subPrevJson   = subPrevRes.status   === 'fulfilled' && subPrevRes.value?.ok  ? await subPrevRes.value.json()  : null
        const unsubPrevJson = unsubPrevRes.status === 'fulfilled' && unsubPrevRes.value?.ok ? await unsubPrevRes.value.json() : null
        const subCurCounts   = parseMetricCount(subCurJson)
        const unsubCurCounts = parseMetricCount(unsubCurJson)
        const subPrevCounts   = needsPrevYear ? parseMetricCount(subPrevJson)   : subCurCounts
        const unsubPrevCounts = needsPrevYear ? parseMetricCount(unsubPrevJson) : unsubCurCounts
        const curSub   = subCurCounts[month]         ?? null
        const curUnsub = unsubCurCounts[month]       ?? null
        const prvSub   = subPrevCounts[prevMonthKey]   ?? null
        const prvUnsub = unsubPrevCounts[prevMonthKey] ?? null
        if (curSub !== null && curUnsub !== null) {
          newSubscribers = curSub
          unsubscribes   = curUnsub
          netGrowth      = curSub - curUnsub
        }
        if (prvSub !== null && prvUnsub !== null) {
          prevNetGrowth = prvSub - prvUnsub
        }
      }

      // YoY revenue
      // Campaigns: one call per year — the route follows Klaviyo pagination internally.
      // Flows: one call per month per year — the flow-series-report endpoint paginates
      // by result count (flow × month combinations), so a full-year call can drop months
      // beyond the first page. Single-month calls return scalar stats in one page each.
      const yoyYears = [year - 2, year - 1, year]
      const yoyMonthKeys = yoyYears.flatMap(y =>
        Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`)
      )

      const [yoyCampResults, yoyFlowResults] = await Promise.all([
        Promise.allSettled(
          yoyYears.map(y =>
            fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: y }) })
          )
        ),
        Promise.allSettled(
          yoyMonthKeys.map(mk =>
            fetch('/api/klaviyo-flows', { method: 'POST', headers, body: JSON.stringify({ account: brand.klaviyo_account, year: parseInt(mk.split('-')[0]), month: mk }) })
          )
        ),
      ])

      const yoyRevenue = await Promise.all(yoyYears.map(async (y, yi) => {
        const campR = yoyCampResults[yi]
        const campD = campR.status === 'fulfilled' && campR.value.ok ? await campR.value.json() : {}
        const campMonthly: { month: string; revenue: number }[] = campD.monthly ?? []

        const monthMap: Record<string, number> = {}
        for (const m of campMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)

        for (let mi = 0; mi < 12; mi++) {
          const flowR = yoyFlowResults[yi * 12 + mi]
          if (flowR.status === 'fulfilled' && flowR.value.ok) {
            const flowD = await flowR.value.json()
            const flowMonthly: { month: string; revenue: number }[] = flowD.monthly ?? []
            for (const m of flowMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
          }
        }

        return {
          year: y,
          months: Object.entries(monthMap)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => a.month.localeCompare(b.month)),
        }
      }))

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
        netGrowth,
        newSubscribers,
        unsubscribes,
        prevNetGrowth,
        yoyRevenue,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

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
      const headers = { 'Content-Type': 'application/json' }

      // Build complete YoY revenue before saving.
      // Past years come from static hardcoded data (no API calls needed).
      // Current year is fetched live. For brands not in YOY_STATIC_REVENUE,
      // fall back to live fetch for all years.
      let yoyRevenue: ReportData['yoyRevenue'] = data?.yoyRevenue ?? []
      const infoRes = await fetch(`/api/report-notes?brandId=${brandId}&month=${month}`)
      if (infoRes.ok) {
        const { brand: b } = await infoRes.json()
        if (b?.klaviyo_account) {
          const staticRows = YOY_STATIC_REVENUE[b.klaviyo_account]
          const freshYoy: ReportData['yoyRevenue'] = []

          if (staticRows) {
            // Past years: group static rows by year (only years before current)
            const byYear: Record<number, { month: string; revenue: number }[]> = {}
            for (const row of staticRows) {
              const y = parseInt(row.month.split('-')[0], 10)
              if (y < year) {
                if (!byYear[y]) byYear[y] = []
                byYear[y].push(row)
              }
            }
            for (const [y, months] of Object.entries(byYear)) {
              freshYoy.push({
                year: parseInt(y, 10),
                months: months.sort((a, b) => a.month.localeCompare(b.month)),
              })
            }

            // Current year: fetch live
            const [campResult, flowResult] = await Promise.allSettled([
              fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: b.klaviyo_account, year }) }),
              fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: b.klaviyo_account, year }) }),
            ])
            const campD = campResult.status === 'fulfilled' && campResult.value.ok ? await campResult.value.json() : {}
            const flowD = flowResult.status === 'fulfilled' && flowResult.value.ok ? await flowResult.value.json() : {}
            const campMonthly: { month: string; revenue: number }[] = campD.monthly ?? []
            const flowMonthly: { month: string; revenue: number }[] = flowD.monthly ?? []
            const monthMap: Record<string, number> = {}
            for (const m of campMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
            for (const m of flowMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
            freshYoy.push({
              year,
              months: Object.entries(monthMap)
                .map(([m, revenue]) => ({ month: m, revenue }))
                .sort((a, b) => a.month.localeCompare(b.month)),
            })
          } else {
            // Brand not in static data — live fetch for all years with rate-limit delay
            const yoyYears = [year - 2, year - 1, year]
            for (let yi = 0; yi < yoyYears.length; yi++) {
              if (yi > 0) await new Promise(r => setTimeout(r, 500))
              const y = yoyYears[yi]
              const [campResult, flowResult] = await Promise.allSettled([
                fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body: JSON.stringify({ account: b.klaviyo_account, year: y }) }),
                fetch('/api/klaviyo-flows',     { method: 'POST', headers, body: JSON.stringify({ account: b.klaviyo_account, year: y }) }),
              ])
              const campD = campResult.status === 'fulfilled' && campResult.value.ok ? await campResult.value.json() : {}
              const flowD = flowResult.status === 'fulfilled' && flowResult.value.ok ? await flowResult.value.json() : {}
              const campMonthly: { month: string; revenue: number }[] = campD.monthly ?? []
              const flowMonthly: { month: string; revenue: number }[] = flowD.monthly ?? []
              const monthMap: Record<string, number> = {}
              for (const m of campMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
              for (const m of flowMonthly) monthMap[m.month] = (monthMap[m.month] ?? 0) + (m.revenue ?? 0)
              freshYoy.push({
                year: y,
                months: Object.entries(monthMap)
                  .map(([m, revenue]) => ({ month: m, revenue }))
                  .sort((a, b) => a.month.localeCompare(b.month)),
              })
            }
          }

          yoyRevenue = freshYoy.sort((a, b) => a.year - b.year)
        }
      }
      console.log('[saveNotes] yoyRevenue being saved:', JSON.stringify(yoyRevenue.slice(0, 3)))

      const res = await fetch('/api/report-notes', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brandId,
          month,
          emails_published: notes.emails_published,
          flows_watching: notes.flows_watching,
          key_focus: notes.key_focus,
          snapshot: data ? { ...data, yoyRevenue } : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Failed to save notes:', err)
      } else {
        setNotesSaved(true)
        setSnapshotDate(new Date().toISOString())
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
              {/* Snapshot bar */}
              <div className="flex items-center justify-between mt-3 px-1">
                <p className="text-xs text-gray-400">
                  {snapshotDate
                    ? `Snapshot from ${new Date(snapshotDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'No snapshot saved yet'}
                </p>
                {isAuthed && (
                  <button
                    onClick={refresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors no-print ml-4"
                  >
                    {isRefreshing ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>↻ Refresh live data</>
                    )}
                  </button>
                )}
              </div>
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
        <div className="grid grid-cols-6 gap-3">
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
          {/* Net subscriber growth */}
          <div className="rounded-xl border border-gray-100 bg-white p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Net Subs</p>
            <p className={`text-2xl font-bold mb-1 ${data.netGrowth == null ? 'text-gray-900' : data.netGrowth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {data.netGrowth == null ? '—' : `${data.netGrowth >= 0 ? '+' : ''}${data.netGrowth}`}
            </p>
            {data.newSubscribers != null && data.unsubscribes != null && (
              <p className="text-xs text-gray-400 mb-1">+{data.newSubscribers} / −{data.unsubscribes}</p>
            )}
            <div className="flex items-center gap-1">
              {data.netGrowth != null && data.prevNetGrowth != null && (
                data.netGrowth >= data.prevNetGrowth
                  ? <TrendingUp className="w-4 h-4 text-green-500" />
                  : <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className="text-xs text-gray-400">
                {data.netGrowth != null && data.prevNetGrowth != null
                  ? `${data.netGrowth >= data.prevNetGrowth ? '+' : ''}${data.netGrowth - data.prevNetGrowth} vs last month`
                  : 'No prior data'}
              </span>
            </div>
          </div>
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

        {/* YoY revenue chart */}
        {data.yoyRevenue && data.yoyRevenue.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
              Revenue — Year on Year
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={(() => {
                  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                  return monthNames.map((name, i) => {
                    const monthNum = String(i + 1).padStart(2, '0')
                    const entry: Record<string, string | number> = { month: name }
                    for (const yearData of data.yoyRevenue) {
                      const found = yearData.months.find(m => m.month.endsWith(`-${monthNum}`))
                      entry[String(yearData.year)] = found?.revenue ?? 0
                    }
                    return entry
                  })
                })()}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    `A$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                    String(name),
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #F3F4F6', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                {data.yoyRevenue.map((yearData, i) => (
                  <Bar
                    key={yearData.year}
                    dataKey={String(yearData.year)}
                    fill={i === 2 ? color : i === 1 ? '#94A3B8' : '#CBD5E1'}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
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
