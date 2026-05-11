'use client'

import { useState, useEffect, useMemo } from 'react'
import { Share2, Pencil, Check, X } from 'lucide-react'
import { MonthData, BlendedMonth, fmtRate, fmtCount, fmtCurrency, monthLabel } from '@/lib/performance'
import MetricCard from './MetricCard'
import MonthlyTable from './MonthlyTable'
import OpenRateChart from './OpenRateChart'
import SendReportModal from './SendReportModal'
import CampaignFlowBreakdown from './CampaignFlowBreakdown'
import { getBrandCost, upsertBrandCost } from '@/lib/actions/roi'

interface OverviewTabProps {
  data: MonthData[]
  brand: string
  brandId: string
  year: number
  klaviyoAccount?: string | null
  blendedMonthly?: BlendedMonth[]
}

function trend(current: number | null, prev: number | null): 'up' | 'down' | 'flat' | null {
  if (current === null || prev === null) return null
  if (current > prev) return 'up'
  if (current < prev) return 'down'
  return 'flat'
}

function prevOf(data: MonthData[], month: MonthData): MonthData | null {
  const idx = data.indexOf(month)
  if (idx <= 0) return null
  return data[idx - 1]
}

function pctChange(current: number | null, prev: number | null): string | null {
  if (current === null || prev === null || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}

function trendLabel(prevMonth: MonthData | null, current: number | null, prevVal: number | null): string | undefined {
  if (!prevMonth) return undefined
  const pct = pctChange(current, prevVal)
  return pct !== null ? `vs ${monthLabel(prevMonth.month)}: ${pct}` : undefined
}

export default function OverviewTab({ data, brand, brandId, year, klaviyoAccount, blendedMonthly = [] }: OverviewTabProps) {
  const [reportMonth, setReportMonth] = useState<MonthData | null>(null)
  const [monthlyCost, setMonthlyCost] = useState<number | null>(null)
  const [editingCost, setEditingCost] = useState(false)
  const [costInput, setCostInput] = useState('')
  const [savingCost, setSavingCost] = useState(false)

  const now = new Date()
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const activeData = data.filter(r => r.sent !== null)
  const currentMonthData = data.find(r => r.month === currentKey)
  const featured = currentMonthData ?? activeData[activeData.length - 1] ?? null
  const prev = featured ? prevOf(activeData, featured) : null

  // Blended open/click rates from campaign + flow monthly data
  const blended = featured ? blendedMonthly.find(b => b.month === featured.month) ?? null : null
  const blendedOpenRate  = blended && blended.delivered > 0 ? (blended.opensUnique  / blended.delivered) * 100 : null
  const blendedClickRate = blended && blended.delivered > 0 ? (blended.clicksUnique / blended.delivered) * 100 : null
  const blendedCtor      = blended && blended.opensUnique > 0 ? (blended.clicksUnique / blended.opensUnique) * 100 : null

  const displayOpenRate  = blended ? blendedOpenRate  : featured?.openRate  ?? null
  const displayClickRate = blended ? blendedClickRate : featured?.clickRate ?? null
  const displayCtor      = blended ? blendedCtor      : featured?.ctor      ?? null
  const displayDelivered = blended ? blended.delivered : featured?.sent ?? null

  // ROI — last month
  const lastMonthKey = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastMonthData = data.find(d => d.month === lastMonthKey) ?? null
  const prevLastMonthData = lastMonthData ? prevOf(activeData, lastMonthData) : null
  const lastMonthRevenue = lastMonthData?.revenue ?? null

  useEffect(() => {
    if (!brandId) return
    getBrandCost(brandId, lastMonthKey).then(cost => {
      setMonthlyCost(cost)
      setCostInput(cost?.toString() ?? '')
    })
  }, [brandId, lastMonthKey])

  const roiMultiplier = (monthlyCost && lastMonthRevenue && monthlyCost > 0)
    ? lastMonthRevenue / monthlyCost
    : null

  const prevRoiMultiplier = (monthlyCost && prevLastMonthData?.revenue && monthlyCost > 0)
    ? prevLastMonthData.revenue / monthlyCost
    : null

  const roiTrend = roiMultiplier !== null && prevRoiMultiplier !== null
    ? roiMultiplier > prevRoiMultiplier ? 'up' : roiMultiplier < prevRoiMultiplier ? 'down' : 'flat'
    : null

  async function handleSaveCost() {
    const val = parseFloat(costInput)
    if (isNaN(val) || val <= 0) return
    setSavingCost(true)
    try {
      await upsertBrandCost(brandId, lastMonthKey, val)
      setMonthlyCost(val)
      setEditingCost(false)
    } finally {
      setSavingCost(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Summary cards for featured month */}
      {featured ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
              {monthLabel(featured.month)} — Month to Date
            </h3>
            <button
              onClick={() => setReportMonth(featured)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share report
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Open Rate"
              value={fmtRate(displayOpenRate)}
              trend={trend(displayOpenRate, prev?.openRate ?? null)}
              trendLabel={trendLabel(prev, displayOpenRate, prev?.openRate ?? null)}
            />
            <MetricCard
              label="Click Rate"
              value={fmtRate(displayClickRate)}
              trend={trend(displayClickRate, prev?.clickRate ?? null)}
              trendLabel={trendLabel(prev, displayClickRate, prev?.clickRate ?? null)}
            />
            <MetricCard
              label="CTOR"
              value={fmtRate(displayCtor)}
              trend={trend(displayCtor, prev?.ctor ?? null)}
              trendLabel={trendLabel(prev, displayCtor, prev?.ctor ?? null)}
            />
            <MetricCard
              label="Revenue"
              value={fmtCurrency(featured.revenue)}
              subValue={`${fmtCount(displayDelivered)} delivered`}
              trend={trend(featured.revenue, prev?.revenue ?? null)}
              trendLabel={trendLabel(prev, featured.revenue, prev?.revenue ?? null)}
            />

            {/* ROI Card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  ROI — {monthLabel(lastMonthKey)}
                </p>
                {!editingCost && (
                  <button
                    onClick={() => setEditingCost(true)}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Edit monthly cost"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>

              {roiMultiplier !== null ? (
                <p className="text-3xl font-bold text-gray-900 tracking-tight">
                  {roiMultiplier.toFixed(1)}x
                </p>
              ) : (
                <p className="text-3xl font-bold text-gray-300">—</p>
              )}

              {editingCost ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">A$</span>
                  <input
                    type="number"
                    value={costInput}
                    onChange={e => setCostInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveCost()}
                    className="w-20 text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-300"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveCost}
                    disabled={savingCost}
                    className="text-green-500 hover:text-green-600 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setEditingCost(false); setCostInput(monthlyCost?.toString() ?? '') }}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  {monthlyCost
                    ? `A$${monthlyCost.toLocaleString()} cost · A$${lastMonthRevenue?.toLocaleString() ?? '—'} rev`
                    : 'No cost set — click ✏️ to add'}
                </p>
              )}

              {roiTrend && prevRoiMultiplier !== null && (
                <p className={`text-xs font-medium flex items-center gap-1 ${
                  roiTrend === 'up' ? 'text-green-600' : roiTrend === 'down' ? 'text-red-500' : 'text-gray-400'
                }`}>
                  {roiTrend === 'up' ? '↗' : roiTrend === 'down' ? '↘' : '→'}
                  vs {monthLabel(prevLastMonthData?.month ?? '')}: {prevRoiMultiplier.toFixed(1)}x
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400 text-sm">
          No data loaded yet for this year.
        </div>
      )}

      {/* Open rate chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          Open &amp; Click Rate Trend
        </h3>
        <OpenRateChart data={data} />
      </div>

      {/* Monthly table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          All Months — {year}
        </h3>
        <MonthlyTable data={data} currentMonth={currentKey} blendedMonthly={blendedMonthly} />
      </div>

      {/* Campaign & Flow Breakdown accordion */}
      {klaviyoAccount && (
        <CampaignFlowBreakdown klaviyoAccount={klaviyoAccount} year={year} />
      )}

      {reportMonth && (
        <SendReportModal
          brand={brand}
          year={year}
          month={reportMonth}
          onClose={() => setReportMonth(null)}
        />
      )}
    </div>
  )
}
