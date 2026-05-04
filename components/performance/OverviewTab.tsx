'use client'

import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { MonthData, BlendedMonth, fmtRate, fmtCount, fmtCurrency, monthLabel } from '@/lib/performance'
import MetricCard from './MetricCard'
import MonthlyTable from './MonthlyTable'
import OpenRateChart from './OpenRateChart'
import SendReportModal from './SendReportModal'
import CampaignFlowBreakdown from './CampaignFlowBreakdown'

interface OverviewTabProps {
  data: MonthData[]
  brand: string
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

export default function OverviewTab({ data, brand, year, klaviyoAccount, blendedMonthly = [] }: OverviewTabProps) {
  const [reportMonth, setReportMonth] = useState<MonthData | null>(null)

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
