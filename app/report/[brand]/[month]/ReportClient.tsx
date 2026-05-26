'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Share2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MonthData } from '@/lib/performance'

interface Props {
  brandId: string
  month: string
  brandColor: string
}

interface ReportData {
  brand: { id: string; name: string; color: string; description: string | null }
  month: string
  monthData: MonthData | null
  prevMonthData: MonthData | null
  monthlyCost: number | null
  roi: number | null
  campaignRevenue: number | null
  flowRevenue: number | null
  blendedOpenRate: number | null
  blendedClickRate: number | null
  journalEntries: { flow_name: string; category: string; description: string; outcome: string | null; changed_at: string }[]
}

function fmtCurrency(v: number | null) {
  if (v === null) return '—'
  return `A$${v.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtRate(v: number | null) {
  if (v === null) return '—'
  return `${v.toFixed(2)}%`
}

function trendIcon(current: number | null, prev: number | null, higherIsBetter = true) {
  if (current === null || prev === null) return null
  const up = current > prev
  if (up === higherIsBetter) return <TrendingUp className="w-4 h-4 text-green-500" />
  if (up !== higherIsBetter) return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

function trendLabel(current: number | null, prev: number | null) {
  if (current === null || prev === null || prev === 0) return null
  const diff = ((current - prev) / prev * 100).toFixed(1)
  const sign = current >= prev ? '+' : ''
  return `${sign}${diff}% vs last month`
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-')
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default function ReportClient({ brandId, month, brandColor }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const availableMonths = useMemo(() => {
    const months = []
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const start = new Date(2026, 0, 1)
    let d = new Date(start)
    while (d <= lastMonth) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months.push(key)
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return months.reverse()
  }, [])

  function handleMonthChange(newMonth: string) {
    router.push(`/report/${brandId}/${newMonth}`)
  }

  useEffect(() => {
    fetch(`/api/report-data?brandId=${brandId}&month=${month}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [brandId, month])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderTopColor: brandColor }} />
          <p className="text-sm text-gray-500">Loading report…</p>
        </div>
      </div>
    )
  }

  if (!data || !data.brand) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Report data unavailable.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b-4 print:border-b-0" style={{ borderColor: data.brand.color }}>
        <div className="max-w-4xl mx-auto px-8 py-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.brand.color }} />
              <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{data.brand.name}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{monthLabel(data.month)}</h1>
            <p className="text-sm text-gray-400 mt-1">Email Marketing Performance Report</p>
            <div className="mt-3">
              <select
                value={month}
                onChange={e => handleMonthChange(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 text-gray-600"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
              >
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {new Date(parseInt(m.split('-')[0]), parseInt(m.split('-')[1]) - 1, 1)
                      .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Copied!' : 'Share link'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-colors"
              style={{ backgroundColor: data.brand.color }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8">

        {/* Hero: Revenue + ROI */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="rounded-2xl border border-gray-100 bg-white p-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Total Revenue</p>
            <p className="text-5xl font-bold text-gray-900 mb-3">{fmtCurrency(data.monthData?.revenue ?? null)}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {trendIcon(data.monthData?.revenue ?? null, data.prevMonthData?.revenue ?? null)}
              <span>{trendLabel(data.monthData?.revenue ?? null, data.prevMonthData?.revenue ?? null) ?? 'No prior data'}</span>
            </div>
            {(data.campaignRevenue !== null || data.flowRevenue !== null) && (
              <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                {data.campaignRevenue !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Campaigns</span>
                    <span className="font-medium text-gray-700">{fmtCurrency(data.campaignRevenue)}</span>
                  </div>
                )}
                {data.flowRevenue !== null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Flows</span>
                    <span className="font-medium text-gray-700">{fmtCurrency(data.flowRevenue)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border-2 p-8" style={{ borderColor: data.brand.color + '40', backgroundColor: data.brand.color + '08' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: data.brand.color }}>Klaviyo ROI</p>
            <p className="text-5xl font-bold text-gray-900 mb-3">
              {data.roi ? `${data.roi.toFixed(1)}x` : '—'}
            </p>
            <p className="text-sm text-gray-500">
              {data.monthlyCost ? `A$${data.monthlyCost.toLocaleString()} monthly cost` : 'No cost data'}
            </p>
            {data.roi && (
              <p className="text-sm text-gray-400 mt-2">
                Every $1 spent returned ${data.roi.toFixed(1)}
              </p>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            {
              label: 'Open Rate',
              current: data.blendedOpenRate ?? data.monthData?.openRate ?? null,
              prev: data.prevMonthData?.openRate ?? null,
              higherBetter: true,
            },
            {
              label: 'Click Rate',
              current: data.blendedClickRate ?? data.monthData?.clickRate ?? null,
              prev: data.prevMonthData?.clickRate ?? null,
              higherBetter: true,
            },
            {
              label: 'Unsub Rate',
              current: data.monthData?.unsubRate ?? null,
              prev: data.prevMonthData?.unsubRate ?? null,
              higherBetter: false,
            },
            {
              label: 'Bounce Rate',
              current: data.monthData?.bounceRate ?? null,
              prev: data.prevMonthData?.bounceRate ?? null,
              higherBetter: false,
            },
            {
              label: 'Spam Rate',
              current: data.monthData?.spamRate ?? null,
              prev: data.prevMonthData?.spamRate ?? null,
              higherBetter: false,
            },
          ].map(metric => (
            <div key={metric.label} className="rounded-xl border border-gray-100 bg-white p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{metric.label}</p>
              <p className="text-2xl font-bold text-gray-900 mb-1">{fmtRate(metric.current)}</p>
              <div className="flex items-center gap-1">
                {trendIcon(metric.current, metric.prev, metric.higherBetter)}
                <span className="text-xs text-gray-400">{trendLabel(metric.current, metric.prev) ?? 'No prior data'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Flow journal highlights */}
        {data.journalEntries.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Flow Changes This Month</h2>
            <div className="space-y-3">
              {data.journalEntries.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 flex-shrink-0 ${
                    entry.outcome === 'improved' ? 'bg-green-100 text-green-700' :
                    entry.outcome === 'worse' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {entry.outcome ?? 'unscored'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {entry.flow_name} <span className="text-gray-400 font-normal">· {entry.category}</span>
                    </p>
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-6 flex items-center justify-between text-xs text-gray-400">
          <span>Generated {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="print:hidden">Haverford Marketing Hub</span>
        </div>

      </div>
    </div>
  )
}
