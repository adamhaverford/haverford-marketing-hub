'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Plus,
  Edit2,
  BarChart2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useToast } from '@/components/Toast'

interface Brand {
  id: string
  name: string
  color: string
}

interface Snapshot {
  id: string
  brand_id: string
  month: string
  open_rate: number | null
  click_rate: number | null
  click_to_open_rate: number | null
  revenue_per_recipient: number | null
  notes: string | null
}

interface Props {
  role: string
  brands: Brand[]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toMonthDate(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`
}

function parseMonthDate(dateStr: string): { year: number; month: number } {
  const [year, month] = dateStr.split('-').map(Number)
  return { year, month: month - 1 }
}

function formatMonthLabel(dateStr: string): string {
  const { year, month } = parseMonthDate(dateStr)
  return `${MONTHS[month].slice(0, 3)} ${year}`
}

function Trend({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) {
    return <Minus className="w-4 h-4 text-gray-400" />
  }
  if (current > previous) return <TrendingUp className="w-4 h-4 text-green-500" />
  if (current < previous) return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-gray-400" />
}

function MetricCard({
  label,
  value,
  prevValue,
  format,
}: {
  label: string
  value: number | null
  prevValue: number | null
  format: (v: number) => string
}) {
  const trendColor =
    value === null || prevValue === null
      ? 'text-gray-400'
      : value > prevValue
      ? 'text-green-600'
      : value < prevValue
      ? 'text-red-600'
      : 'text-gray-500'

  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-white hover:border-gray-200 transition-colors">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-2">
        {value !== null ? format(value) : '—'}
      </p>
      <div className="flex items-center gap-1.5">
        <Trend current={value} previous={prevValue} />
        <span className={`text-xs font-medium ${trendColor}`}>
          {prevValue !== null ? `prev ${format(prevValue)}` : 'No previous data'}
        </span>
      </div>
    </div>
  )
}

export default function PerformanceClient({ role, brands }: Props) {
  const { addToast } = useToast()
  const supabase = createClient()

  const now = new Date()
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id ?? '')
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [prevSnapshot, setPrevSnapshot] = useState<Snapshot | null>(null)
  const [chartData, setChartData] = useState<{ month: string; open_rate: number | null }[]>([])
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    open_rate: '',
    click_rate: '',
    click_to_open_rate: '',
    revenue_per_recipient: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const currentMonthDate = toMonthDate(selectedYear, selectedMonth)
  const prevMonthDate = (() => {
    if (selectedMonth === 0) return toMonthDate(selectedYear - 1, 11)
    return toMonthDate(selectedYear, selectedMonth - 1)
  })()

  const fetchData = useCallback(async () => {
    if (!selectedBrandId) return
    setLoading(true)
    try {
      // Fetch last 7 months of snapshots for the chart (6 months + current)
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - i, 1)
        months.push(toMonthDate(d.getFullYear(), d.getMonth()))
      }
      const oldest = months[0]

      const { data } = await supabase
        .from('performance_snapshots')
        .select('*')
        .eq('brand_id', selectedBrandId)
        .gte('month', oldest)
        .lte('month', currentMonthDate)
        .order('month', { ascending: true })

      const snapMap: Record<string, Snapshot> = {}
      ;(data ?? []).forEach((s: Snapshot) => {
        snapMap[s.month] = s
      })

      setSnapshot(snapMap[currentMonthDate] ?? null)
      setPrevSnapshot(snapMap[prevMonthDate] ?? null)
      setChartData(
        months.map(m => ({
          month: formatMonthLabel(m),
          open_rate: snapMap[m]?.open_rate ?? null,
        }))
      )
    } finally {
      setLoading(false)
    }
  }, [selectedBrandId, selectedYear, selectedMonth, supabase, currentMonthDate, prevMonthDate])

  useEffect(() => { fetchData() }, [fetchData])

  function openModal() {
    setForm({
      open_rate: snapshot?.open_rate?.toString() ?? '',
      click_rate: snapshot?.click_rate?.toString() ?? '',
      click_to_open_rate: snapshot?.click_to_open_rate?.toString() ?? '',
      revenue_per_recipient: snapshot?.revenue_per_recipient?.toString() ?? '',
      notes: snapshot?.notes ?? '',
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!selectedBrandId) return
    setSaving(true)
    try {
      const payload = {
        brand_id: selectedBrandId,
        month: currentMonthDate,
        open_rate: form.open_rate ? parseFloat(form.open_rate) : null,
        click_rate: form.click_rate ? parseFloat(form.click_rate) : null,
        click_to_open_rate: form.click_to_open_rate ? parseFloat(form.click_to_open_rate) : null,
        revenue_per_recipient: form.revenue_per_recipient ? parseFloat(form.revenue_per_recipient) : null,
        notes: form.notes || null,
      }

      if (snapshot?.id) {
        await supabase.from('performance_snapshots').update(payload).eq('id', snapshot.id)
      } else {
        await supabase.from('performance_snapshots').insert(payload)
      }

      addToast('Performance data saved.')
      setShowModal(false)
      fetchData()
    } catch {
      addToast('Failed to save. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveNotes() {
    if (!snapshot?.id && !notesValue) return setEditingNotes(false)
    setSavingNotes(true)
    try {
      if (snapshot?.id) {
        await supabase
          .from('performance_snapshots')
          .update({ notes: notesValue || null })
          .eq('id', snapshot.id)
      } else {
        await supabase.from('performance_snapshots').insert({
          brand_id: selectedBrandId,
          month: currentMonthDate,
          notes: notesValue || null,
        })
      }
      addToast('Notes saved.')
      setEditingNotes(false)
      fetchData()
    } catch {
      addToast('Failed to save notes.', 'error')
    } finally {
      setSavingNotes(false)
    }
  }

  const selectedBrand = brands.find(b => b.id === selectedBrandId)
  const isMarketing = role === 'marketing'
  const hasData =
    snapshot?.open_rate !== null ||
    snapshot?.click_rate !== null ||
    snapshot?.click_to_open_rate !== null ||
    snapshot?.revenue_per_recipient !== null

  // Build year options (current year and 2 back)
  const yearOptions = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Performance</h2>
          <p className="text-gray-500">Track email metrics across brands by month.</p>
        </div>
        {isMarketing && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold"
            style={{ backgroundColor: '#E8611A' }}
          >
            {snapshot ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {snapshot ? 'Edit Performance Data' : 'Add Performance Data'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={selectedBrandId}
          onChange={e => setSelectedBrandId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {yearOptions.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Brand + month heading */}
          <div className="flex items-center gap-3 mb-5">
            {selectedBrand && (
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedBrand.color }} />
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedBrand?.name} — {MONTHS[selectedMonth]} {selectedYear}
            </h3>
          </div>

          {/* Metric cards */}
          {hasData ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard
                label="Open Rate"
                value={snapshot?.open_rate ?? null}
                prevValue={prevSnapshot?.open_rate ?? null}
                format={v => `${v.toFixed(1)}%`}
              />
              <MetricCard
                label="Click Rate"
                value={snapshot?.click_rate ?? null}
                prevValue={prevSnapshot?.click_rate ?? null}
                format={v => `${v.toFixed(1)}%`}
              />
              <MetricCard
                label="Click-to-Open Rate"
                value={snapshot?.click_to_open_rate ?? null}
                prevValue={prevSnapshot?.click_to_open_rate ?? null}
                format={v => `${v.toFixed(1)}%`}
              />
              <MetricCard
                label="Revenue / Recipient"
                value={snapshot?.revenue_per_recipient ?? null}
                prevValue={prevSnapshot?.revenue_per_recipient ?? null}
                format={v => `$${v.toFixed(2)}`}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center mb-8">
              <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No data for this period</p>
              {isMarketing && (
                <p className="text-gray-400 text-sm mt-1">
                  Click &ldquo;Add Performance Data&rdquo; to enter metrics.
                </p>
              )}
            </div>
          )}

          {/* Notes section */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-700">
                Notes &amp; Observations
              </h4>
              {isMarketing && !editingNotes && (
                <button
                  onClick={() => { setNotesValue(snapshot?.notes ?? ''); setEditingNotes(true) }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  {snapshot?.notes ? 'Edit notes' : 'Add notes'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  rows={5}
                  placeholder="What worked, what didn't, action items..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
                    style={{ backgroundColor: '#E8611A' }}
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 p-4 min-h-[80px] bg-gray-50">
                {snapshot?.notes ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{snapshot.notes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No notes for this period.</p>
                )}
              </div>
            )}
          </div>

          {/* Open rate trend chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-4">
              Open Rate Trend — Last 6 Months
            </h4>
            {chartData.some(d => d.open_rate !== null) ? (
              <div className="rounded-2xl border border-gray-100 p-5">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `${v}%`}
                      width={40}
                    />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Open Rate']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="open_rate"
                      stroke="#E8611A"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#E8611A', strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">No trend data yet for this brand.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                {snapshot ? 'Edit Performance Data' : 'Add Performance Data'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-gray-50 text-sm text-gray-600">
              <span className="font-medium">{selectedBrand?.name}</span>
              {' — '}
              {MONTHS[selectedMonth]} {selectedYear}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Open Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.open_rate}
                    onChange={e => setForm(f => ({ ...f, open_rate: e.target.value }))}
                    placeholder="e.g. 24.5"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Click Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.click_rate}
                    onChange={e => setForm(f => ({ ...f, click_rate: e.target.value }))}
                    placeholder="e.g. 3.2"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Click-to-Open (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.click_to_open_rate}
                    onChange={e => setForm(f => ({ ...f, click_to_open_rate: e.target.value }))}
                    placeholder="e.g. 13.1"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Revenue / Recipient ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.revenue_per_recipient}
                    onChange={e => setForm(f => ({ ...f, revenue_per_recipient: e.target.value }))}
                    placeholder="e.g. 1.24"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="What worked, what didn't, action items..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#E8611A' }}
              >
                {saving ? 'Saving...' : 'Save Data'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
