'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { fmtRate, fmtCurrency, fmtCount, monthLabel } from '@/lib/performance'
import MetricCard from './MetricCard'

// ── API response types ────────────────────────────────────────

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

interface CampaignMonthlyRow {
  month: string
  recipients: number
  openRate: number | null
  clickRate: number | null
  ctor: number | null
  unsubRate: number | null
  bounceRate: number | null
  revenue: number
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

interface FlowMonthlyRow {
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

// ── Shared table primitives ───────────────────────────────────

const TH = 'px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap'
const TD = 'px-4 py-3 whitespace-nowrap text-gray-600 text-sm'

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full text-sm">{children}</table>
    </div>
  )
}

function SubTabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: readonly T[]; active: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-0.5 mb-6 bg-gray-100/80 rounded-lg p-0.5 w-fit">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            active === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

// ── Campaigns section ─────────────────────────────────────────

const CAMPAIGN_SUB_TABS = ['Summary', 'Year to Date', 'Review'] as const
type CampaignSubTab = typeof CAMPAIGN_SUB_TABS[number]

function CampaignsSection({ data }: { data: { campaigns: CampaignRow[]; monthly: CampaignMonthlyRow[] } }) {
  const latestMonth = data.monthly[data.monthly.length - 1]?.month ?? ''
  const [selectedMonth, setSelectedMonth] = useState(latestMonth)
  const [subTab, setSubTab] = useState<CampaignSubTab>('Summary')

  // If state was initialized before data arrived, fall back to the latest month
  const effectiveMonth = data.monthly.some(m => m.month === selectedMonth) ? selectedMonth : latestMonth
  const monthData = data.monthly.find(m => m.month === effectiveMonth) ?? null
  const campaignRows = data.campaigns
    .filter(c => !effectiveMonth || c.sentAt?.startsWith(effectiveMonth))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))

  return (
    <div>
      <SubTabBar tabs={CAMPAIGN_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'Summary' && (
        <div className="space-y-5">
          {/* Month filter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Month</span>
            <select
              value={effectiveMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {data.monthly.map(m => (
                <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard label="Open Rate"  value={fmtRate(monthData?.openRate  ?? null)} />
            <MetricCard label="Click Rate" value={fmtRate(monthData?.clickRate ?? null)} />
            <MetricCard label="CTOR"       value={fmtRate(monthData?.ctor      ?? null)} />
            <MetricCard label="Revenue"    value={fmtCurrency(monthData ? monthData.revenue : null)} />
            <MetricCard label="Recipients" value={fmtCount(monthData ? monthData.recipients : null)} />
            <MetricCard label="Unsub Rate" value={fmtRate(monthData?.unsubRate ?? null)} />
          </div>
        </div>
      )}

      {subTab === 'Year to Date' && (
        <TableWrap>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              {(['Month', 'Recipients', 'Open Rate', 'Click Rate', 'CTOR', 'Unsub Rate', 'Revenue'] as const).map((h, i) => (
                <th key={h} className={`${TH} ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.monthly.map(m => (
              <tr
                key={m.month}
                className={`border-b border-gray-50 last:border-0 ${m.month === effectiveMonth ? 'bg-orange-50/40' : 'hover:bg-gray-50/50'}`}
              >
                <td className={`${TD} font-semibold text-gray-700`}>{monthLabel(m.month)}</td>
                <td className={`${TD} text-right`}>{fmtCount(m.recipients)}</td>
                <td className={`${TD} text-right`}>{fmtRate(m.openRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(m.clickRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(m.ctor)}</td>
                <td className={`${TD} text-right`}>{fmtRate(m.unsubRate)}</td>
                <td className={`${TD} text-right`}>{fmtCurrency(m.revenue)}</td>
              </tr>
            ))}
            {data.monthly.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400 italic">No monthly data.</td></tr>
            )}
          </tbody>
        </TableWrap>
      )}

      {subTab === 'Review' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Month</span>
            <select
              value={effectiveMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {data.monthly.map(m => (
                <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>
              ))}
            </select>
          </div>
          <TableWrap>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {(['Campaign', 'Date', 'Recipients', 'Open Rate', 'Click Rate', 'Bounce Rate', 'Unsub Rate', 'Revenue'] as const).map((h, i) => (
                  <th key={h} className={`${TH} ${i <= 1 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaignRows.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className={`${TD} font-medium text-gray-900 max-w-xs truncate`} title={c.name}>{c.name}</td>
                  <td className={`${TD}`}>{c.sentAt ? c.sentAt.substring(0, 10) : '—'}</td>
                  <td className={`${TD} text-right`}>{fmtCount(c.recipients)}</td>
                  <td className={`${TD} text-right`}>{fmtRate(c.openRate)}</td>
                  <td className={`${TD} text-right`}>{fmtRate(c.clickRate)}</td>
                  <td className={`${TD} text-right`}>{fmtRate(c.bounceRate)}</td>
                  <td className={`${TD} text-right`}>{fmtRate(c.unsubRate)}</td>
                  <td className={`${TD} text-right`}>{fmtCurrency(c.revenue)}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 italic">No campaigns for this month.</td></tr>
              )}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  )
}

// ── Flows section ─────────────────────────────────────────────

const FLOW_SUB_TABS = ['Summary', 'Year to Date', 'Review'] as const
type FlowSubTab = typeof FLOW_SUB_TABS[number]

function aggregateFlows(flows: FlowRow[]) {
  const flowsWithRecipients = flows.filter(f => f.recipients !== null && f.recipients > 0)
  const totalRecipients = flowsWithRecipients.reduce((s, f) => s + (f.recipients ?? 0), 0)

  function weightedRate(getRateFn: (f: FlowRow) => number | null): number | null {
    if (totalRecipients === 0) return null
    const sum = flowsWithRecipients.reduce((s, f) => {
      const rate = getRateFn(f)
      return rate !== null ? s + (rate / 100) * (f.recipients ?? 0) : s
    }, 0)
    return (sum / totalRecipients) * 100
  }

  const totalOpens  = flowsWithRecipients.reduce((s, f) => s + ((f.openRate  ?? 0) / 100) * (f.recipients ?? 0), 0)
  const totalClicks = flowsWithRecipients.reduce((s, f) => s + ((f.clickRate ?? 0) / 100) * (f.recipients ?? 0), 0)

  return {
    recipients: totalRecipients > 0 ? totalRecipients : null,
    openRate:   weightedRate(f => f.openRate),
    clickRate:  weightedRate(f => f.clickRate),
    ctor:       totalOpens > 0 ? (totalClicks / totalOpens) * 100 : null,
    unsubRate:  weightedRate(f => f.unsubRate),
    bounceRate: weightedRate(f => f.bounceRate),
    revenue:    flows.reduce((s, f) => s + (f.revenue ?? 0), 0) || null,
  }
}

function FlowsSection({
  data,
  klaviyoAccount,
  year,
}: {
  data: { flows: FlowRow[]; monthly: FlowMonthlyRow[] }
  klaviyoAccount: string
  year: number
}) {
  const [subTab, setSubTab] = useState<FlowSubTab>('Summary')

  const availableMonths = useMemo(() => {
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = now.getMonth() + 1
    const maxMonth = year < nowYear ? 12 : year === nowYear ? nowMonth : 0
    const months: string[] = []
    for (let m = 1; m <= maxMonth; m++) {
      months.push(`${year}-${String(m).padStart(2, '0')}`)
    }
    return months
  }, [year])

  // Default to the most recently completed month
  const defaultMonth = useMemo(() => {
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = now.getMonth() + 1
    if (year < nowYear) return `${year}-12`
    if (year === nowYear) {
      const prev = nowMonth - 1
      return prev >= 1
        ? `${year}-${String(prev).padStart(2, '0')}`
        : `${year}-01`
    }
    return availableMonths[0] ?? ''
  }, [year, availableMonths])

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [summaryFlows, setSummaryFlows] = useState<FlowRow[]>(data.flows)
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    if (!selectedMonth) return
    setSummaryLoading(true)
    fetch('/api/klaviyo-flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: klaviyoAccount, year, month: selectedMonth }),
    })
      .then(r => r.json())
      .then(json => { if (!json.error) setSummaryFlows(json.flows ?? []) })
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [selectedMonth, klaviyoAccount, year])

  const aggregated = aggregateFlows(summaryFlows)

  return (
    <div>
      <SubTabBar tabs={FLOW_SUB_TABS} active={subTab} onChange={setSubTab} />

      {subTab === 'Summary' && (
        <div className="space-y-5">
          {/* Month filter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Month</span>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard label="Open Rate"   value={fmtRate(aggregated.openRate)} />
              <MetricCard label="Click Rate"  value={fmtRate(aggregated.clickRate)} />
              <MetricCard label="CTOR"        value={fmtRate(aggregated.ctor)} />
              <MetricCard label="Revenue"     value={fmtCurrency(aggregated.revenue)} />
              <MetricCard label="Recipients"  value={fmtCount(aggregated.recipients)} />
              <MetricCard label="Unsub Rate"  value={fmtRate(aggregated.unsubRate)} />
            </div>
          )}
        </div>
      )}

      {subTab === 'Year to Date' && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-500">
          Monthly flow data is not available from Klaviyo&apos;s API. Use the <span className="font-medium">Review</span> tab to see per-flow performance.
        </div>
      )}

      {subTab === 'Review' && (
        <TableWrap>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              {(['Flow Name', 'Recipients', 'Open Rate', 'Click Rate', 'Bounce Rate', 'Unsub Rate', 'Spam', 'Orders', 'AOV', 'Revenue'] as const).map((h, i) => (
                <th key={h} className={`${TH} ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.flows.map(f => (
              <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className={`${TD} font-medium text-gray-900 max-w-xs truncate`} title={f.name}>{f.name}</td>
                <td className={`${TD} text-right`}>{fmtCount(f.recipients)}</td>
                <td className={`${TD} text-right`}>{fmtRate(f.openRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(f.clickRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(f.bounceRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(f.unsubRate)}</td>
                <td className={`${TD} text-right`}>{fmtRate(f.spamRate)}</td>
                <td className={`${TD} text-right`}>{fmtCount(f.placedOrderCount)}</td>
                <td className={`${TD} text-right`}>{fmtCurrency(f.aov)}</td>
                <td className={`${TD} text-right`}>{fmtCurrency(f.revenue)}</td>
              </tr>
            ))}
            {data.flows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400 italic">No flows data.</td></tr>
            )}
          </tbody>
        </TableWrap>
      )}
    </div>
  )
}

// ── Main accordion component ──────────────────────────────────

interface Props {
  klaviyoAccount: string
  year: number
}

export default function CampaignFlowBreakdown({ klaviyoAccount, year }: Props) {
  const [expanded, setExpanded]           = useState(false)
  const [hasLoaded, setHasLoaded]         = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'Campaigns' | 'Flows'>('Campaigns')
  const [campaignsData, setCampaignsData] = useState<{ campaigns: CampaignRow[]; monthly: CampaignMonthlyRow[] } | null>(null)
  const [flowsData, setFlowsData]         = useState<{ flows: FlowRow[]; monthly: FlowMonthlyRow[] } | null>(null)

  async function handleToggle() {
    const opening = !expanded
    setExpanded(opening)

    if (opening && !hasLoaded) {
      setLoading(true)
      setError(null)
      try {
        const body    = JSON.stringify({ account: klaviyoAccount, year })
        const headers = { 'Content-Type': 'application/json' }
        const [cRes, fRes] = await Promise.all([
          fetch('/api/klaviyo-campaigns', { method: 'POST', headers, body }),
          fetch('/api/klaviyo-flows',     { method: 'POST', headers, body }),
        ])
        const [cJson, fJson] = await Promise.all([cRes.json(), fRes.json()])
        console.log('[CampaignFlowBreakdown] campaigns response:', JSON.stringify(cJson, null, 2))
        console.log('[CampaignFlowBreakdown] flows response:', JSON.stringify(fJson, null, 2))
        if (cJson.error) throw new Error(`Campaigns: ${cJson.error}`)
        if (fJson.error) throw new Error(`Flows: ${fJson.error}`)
        setCampaignsData(cJson)
        setFlowsData(fJson)
        setHasLoaded(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load breakdown data')
      } finally {
        setLoading(false)
      }
    }
  }

  function handleTopTabChange(tab: 'Campaigns' | 'Flows') {
    setActiveTab(tab)
  }

  return (
    <div>
      {/* Accordion header */}
      <button
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${expanded ? 'rounded-t-xl' : 'rounded-xl'}`}
        style={{ backgroundColor: '#E8611A' }}
      >
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
          Campaign &amp; Flow Breakdown
        </h3>
        <ChevronDown className={`w-4 h-4 text-white transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Accordion body */}
      {expanded && (
        <div className="border border-t-0 border-orange-200 rounded-b-xl px-5 pb-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading campaign and flow data…</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Content */}
          {!loading && hasLoaded && (
            <>
              {/* Top tab bar — Campaigns / Flows */}
              <div className="flex gap-1 mt-5 mb-3 bg-gray-100 rounded-xl p-1 w-fit">
                {(['Campaigns', 'Flows'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => handleTopTabChange(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Section content — key resets sub-tab state on top-tab switch */}
              {activeTab === 'Campaigns' && campaignsData && (
                <CampaignsSection key="campaigns" data={campaignsData} />
              )}
              {activeTab === 'Flows' && flowsData && (
                <FlowsSection key="flows" data={flowsData} klaviyoAccount={klaviyoAccount} year={year} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
