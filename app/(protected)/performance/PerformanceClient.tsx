'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { RefreshCw, AlertCircle, FileText, Save } from 'lucide-react'
import { fetchPerformanceData, MonthData } from '@/lib/performance'
import { useToast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import OverviewTab from '@/components/performance/OverviewTab'
import SpamTab from '@/components/performance/SpamTab'

interface Brand {
  id: string
  name: string
  color: string
  klaviyo_account: string | null
}

interface Props {
  brands: Brand[]
}

const TABS = ['Overview', 'Spam'] as const
type Tab = typeof TABS[number]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR]

export default function PerformanceClient({ brands }: Props) {
  const { addToast } = useToast()
  const supabase = createClient()

  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id ?? '')
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')

  const [data, setData] = useState<MonthData[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [notes, setNotes] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')
  const [, startNotesTransition] = useTransition()
  const [savingNotes, setSavingNotes] = useState(false)

  const selectedBrand = brands.find(b => b.id === selectedBrandId)

  const fetchNotes = useCallback(async () => {
    if (!selectedBrandId) return
    const { data: row } = await supabase
      .from('performance_notes')
      .select('notes')
      .eq('brand_id', selectedBrandId)
      .eq('year', selectedYear)
      .maybeSingle()
    setNotes(row?.notes ?? '')
  }, [selectedBrandId, selectedYear, supabase])

  const loadData = useCallback(async () => {
    if (!selectedBrand?.klaviyo_account) {
      setData(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPerformanceData(selectedBrand.klaviyo_account, selectedYear)
      setData(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load performance data')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, selectedYear])

  useEffect(() => {
    loadData()
    fetchNotes()
  }, [loadData, fetchNotes])

  async function handleSaveNotes() {
    if (!selectedBrandId) return
    setSavingNotes(true)
    startNotesTransition(async () => {
      try {
        await supabase
          .from('performance_notes')
          .upsert(
            { brand_id: selectedBrandId, year: selectedYear, notes: notesValue || null },
            { onConflict: 'brand_id,year' }
          )
        setNotes(notesValue)
        setEditingNotes(false)
        addToast('Notes saved.')
      } catch {
        addToast('Failed to save notes.', 'error')
      } finally {
        setSavingNotes(false)
      }
    })
  }

  const noKlaviyo = selectedBrand && !selectedBrand.klaviyo_account

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Performance</h2>
          <p className="text-gray-500">Live email metrics from Klaviyo, updated in real time.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading || noKlaviyo}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={selectedBrandId}
          onChange={e => { setSelectedBrandId(e.target.value); setData(null) }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={e => { setSelectedYear(Number(e.target.value)); setData(null) }}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {YEAR_OPTIONS.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* No Klaviyo account configured */}
      {noKlaviyo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold mb-1">No Klaviyo account linked for {selectedBrand.name}</p>
            <p className="text-amber-700">
              Run migration 009_performance.sql and set <code className="bg-amber-100 px-1 rounded">klaviyo_account</code> on this brand to enable live metrics.
            </p>
          </div>
        </div>
      )}

      {/* API error */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3 text-red-800 text-sm mb-8">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-500" />
          <div>
            <p className="font-semibold mb-0.5">Failed to load data</p>
            <p className="text-red-700 font-mono text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Fetching data from Klaviyo…</p>
        </div>
      )}

      {/* Main content */}
      {!loading && !error && data && (
        <>
          {/* Brand + year heading */}
          <div className="flex items-center gap-3 mb-6">
            {selectedBrand && (
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedBrand.color }} />
            )}
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedBrand?.name} — {selectedYear}
            </h3>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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

          {/* Tab content */}
          {activeTab === 'Overview' && (
            <OverviewTab data={data} brand={selectedBrand?.name ?? ''} year={selectedYear} />
          )}
          {activeTab === 'Spam' && (
            <SpamTab data={data} year={selectedYear} />
          )}

          {/* Notes section (shared across tabs) */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-700">Notes — {selectedYear}</h4>
              </div>
              {!editingNotes && (
                <button
                  onClick={() => { setNotesValue(notes); setEditingNotes(true) }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  {notes ? 'Edit notes' : 'Add notes'}
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-3">
                <textarea
                  value={notesValue}
                  onChange={e => setNotesValue(e.target.value)}
                  rows={4}
                  placeholder="Year-level observations, patterns, key wins or losses…"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
                    style={{ backgroundColor: '#E8611A' }}
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingNotes ? 'Saving…' : 'Save Notes'}
                  </button>
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-100 p-4 min-h-[72px] bg-gray-50">
                {notes ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No notes for {selectedYear} yet.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
