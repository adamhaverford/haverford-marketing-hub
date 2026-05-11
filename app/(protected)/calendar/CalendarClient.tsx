'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addTopic } from '@/lib/actions/planning'
import { X, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'

type CalendarEvent = {
  id: string
  brand_name: string
  date: string
  event_name: string | null
  region: string | null
  campaign_name: string | null
  status: 'Scheduled' | 'Drafted' | 'Idea' | null
  type: 'Calendar Event' | 'Brand Recall & Engagement' | 'Value or Content' | 'Sale or Promotion' | null
  incentive: string | null
}

type Brand = { id: string; name: string; color: string }
type ViewMode = 'month' | 'list'

const TYPE_STYLES: Record<string, { chip: string; dot: string }> = {
  'Calendar Event':            { chip: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400'   },
  'Brand Recall & Engagement': { chip: 'bg-purple-50 text-purple-700', dot: 'bg-purple-400' },
  'Value or Content':          { chip: 'bg-teal-50 text-teal-700',     dot: 'bg-teal-400'   },
  'Sale or Promotion':         { chip: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
}

const STATUS_STYLES: Record<string, string> = {
  'Scheduled': 'bg-green-100 text-green-700',
  'Drafted':   'bg-amber-100 text-amber-700',
  'Idea':      'bg-gray-100 text-gray-500',
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default function CalendarClient({ brands }: { brands: Brand[] }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(brands[0] ?? null)
  const [filterType, setFilterType] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [modalEvent, setModalEvent] = useState<CalendarEvent | null>(null)
  const [planningBrandId, setPlanningBrandId] = useState(brands[0]?.id ?? '')
  const [planningMonth, setPlanningMonth] = useState('')
  const [topicType, setTopicType] = useState<'evergreen' | 'promotional'>('promotional')
  const [adding, setAdding] = useState(false)
  const [addSuccess, setAddSuccess] = useState('')

  useEffect(() => {
    if (!selectedBrand) return
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('calendar_events')
      .select('*')
      .eq('brand_name', selectedBrand.name)
      .order('date')
      .then(({ data }) => {
        setEvents(data ?? [])
        setLoading(false)
      })
  }, [selectedBrand])

  const filtered = useMemo(() => {
    return events.filter(e => !filterType || e.type === filterType)
  }, [events, filterType])

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // ── Month grid helpers ──────────────────────────────────────────
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  // Monday-based: 0=Mon … 6=Sun
  const startPad = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7

  const cells: { dateStr: string; inMonth: boolean }[] = []
  for (let i = 0; i < totalCells; i++) {
    const offset = i - startPad
    if (offset < 0) {
      const d = daysInPrevMonth + offset + 1
      const m = month === 0 ? 12 : month
      const y = month === 0 ? year - 1 : year
      cells.push({ dateStr: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth: false })
    } else if (offset < daysInMonth) {
      const d = offset + 1
      cells.push({ dateStr: `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth: true })
    } else {
      const d = offset - daysInMonth + 1
      const m = month === 11 ? 1 : month + 2
      const y = month === 11 ? year + 1 : year
      cells.push({ dateStr: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`, inMonth: false })
    }
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    filtered.forEach(e => {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    })
    return map
  }, [filtered])

  // ── List view grouping ──────────────────────────────────────────
  const listEvents = useMemo(() => {
    return filtered.filter(e => e.campaign_name)
  }, [filtered])

  const groupedByMonth = useMemo(() => {
    const groups: { label: string; events: CalendarEvent[] }[] = []
    const seen: Record<string, number> = {}
    listEvents.forEach(e => {
      const key = e.date.slice(0, 7)
      if (seen[key] === undefined) {
        seen[key] = groups.length
        groups.push({ label: getMonthLabel(e.date), events: [] })
      }
      groups[seen[key]].events.push(e)
    })
    return groups
  }, [listEvents])

  // ── Add to Planning ─────────────────────────────────────────────
  async function handleAddToPlanning() {
    if (!modalEvent || !planningBrandId || !planningMonth) return
    setAdding(true)
    try {
      await addTopic({
        brand_id: planningBrandId,
        month: planningMonth,
        type: topicType,
        title: modalEvent.campaign_name ?? modalEvent.event_name ?? 'Untitled',
        description: [
          modalEvent.type && modalEvent.type !== 'Calendar Event' ? `Type: ${modalEvent.type}` : null,
          modalEvent.status ? `Status: ${modalEvent.status}` : null,
          modalEvent.incentive ? `Incentive: ${modalEvent.incentive}` : null,
          modalEvent.region ? `Region: ${modalEvent.region}` : null,
        ].filter(Boolean).join(' · ') || null,
      })
      const brand = brands.find(b => b.id === planningBrandId)
      const monthLabel = new Date(planningMonth + '-01').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
      setAddSuccess(`✓ Added to ${brand?.name} — ${monthLabel}`)
      setTimeout(() => { setShowAddModal(false); setAddSuccess('') }, 2000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      if (msg.includes('Unauthorized')) {
        setAddSuccess('Only marketing users can add to planning.')
      } else {
        setAddSuccess(`Error: ${msg}`)
      }
    } finally {
      setAdding(false)
    }
  }

  function openAddModal(event: CalendarEvent) {
    setModalEvent(event)
    setPlanningMonth(event.date.substring(0, 7))
    setShowAddModal(true)
  }

  return (
    <div className="flex h-full">
      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 p-8 overflow-auto min-w-0">
        {/* Header */}
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Campaign Calendar</h2>
        <p className="text-gray-500 text-sm mb-6">Browse campaign ideas and add them to your planning.</p>

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Brand selector */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
            {selectedBrand && (
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedBrand.color || '#6366f1' }}
              />
            )}
            <select
              value={selectedBrand?.id ?? ''}
              onChange={e => {
                const b = brands.find(b => b.id === e.target.value) ?? null
                setSelectedBrand(b)
                if (b) setPlanningBrandId(b.id)
              }}
              className="text-sm text-gray-700 bg-transparent focus:outline-none pr-1"
            >
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="Calendar Event">Calendar Event</option>
            <option value="Brand Recall & Engagement">Brand Recall &amp; Engagement</option>
            <option value="Value or Content">Value or Content</option>
            <option value="Sale or Promotion">Sale or Promotion</option>
          </select>

          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('month')}
              className="p-2 transition-colors"
              style={viewMode === 'month' ? { backgroundColor: '#E8611A', color: 'white' } : { color: '#6b7280' }}
              title="Month view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="p-2 transition-colors"
              style={viewMode === 'list' ? { backgroundColor: '#E8611A', color: 'white' } : { color: '#6b7280' }}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Month nav (month view only) */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[110px] text-center">
                {MONTHS[month]} {year}
              </span>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">Loading events…</div>
        ) : viewMode === 'month' ? (
          /* ── Month grid ───────────────────────────────────────── */
          <div>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_SHORT.map(d => (
                <div key={d} className="text-xs font-medium text-gray-400 text-center py-1">{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map(({ dateStr, inMonth }) => {
                const dayEvents = eventsByDate[dateStr] ?? []
                const dayNum = parseInt(dateStr.slice(8), 10)
                const isToday = dateStr === todayStr
                return (
                  <div
                    key={dateStr}
                    className={`border border-gray-100 rounded-lg p-1.5 min-h-[90px] ${!inMonth ? 'bg-gray-50 opacity-50' : 'bg-white'}`}
                  >
                    <div className="flex justify-end mb-1">
                      <span className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? 'text-white' : 'text-gray-500'
                      }`} style={isToday ? { backgroundColor: '#E8611A' } : {}}>
                        {dayNum}
                      </span>
                    </div>
                    {dayEvents.slice(0, 3).map(ev => {
                      const style = ev.type ? TYPE_STYLES[ev.type] : { chip: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' }
                      return (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`text-xs px-1.5 py-0.5 rounded-md truncate cursor-pointer mb-0.5 ${style.chip}`}
                          title={ev.campaign_name ?? ev.event_name ?? ''}
                        >
                          {ev.campaign_name ?? ev.event_name}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div
                        onClick={() => setSelectedEvent(dayEvents[3])}
                        className="text-xs px-1.5 py-0.5 rounded-md truncate cursor-pointer text-gray-400 hover:text-gray-600"
                      >
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ── List view ────────────────────────────────────────── */
          <div>
            {groupedByMonth.length === 0 && (
              <p className="text-sm text-gray-400 py-12 text-center">No campaign events found.</p>
            )}
            {groupedByMonth.map(group => (
              <div key={group.label}>
                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-6 first:mt-0">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.events.map(ev => {
                    const typeStyle = ev.type ? TYPE_STYLES[ev.type] : { chip: 'bg-gray-100 text-gray-500', dot: 'bg-gray-300' }
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer group"
                      >
                        <span className="text-sm text-gray-500 w-16 flex-shrink-0">{formatDateShort(ev.date)}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${typeStyle.dot}`} />
                        <span className="font-medium text-sm text-gray-800 flex-1 min-w-0 truncate">
                          {ev.campaign_name ?? ev.event_name}
                        </span>
                        {ev.status && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[ev.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {ev.status}
                          </span>
                        )}
                        {ev.region && (
                          <span className="text-xs text-gray-400 flex-shrink-0">{ev.region}</span>
                        )}
                        {ev.campaign_name && (
                          <button
                            onClick={e => { e.stopPropagation(); openAddModal(ev) }}
                            className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-medium text-white flex-shrink-0"
                            style={{ backgroundColor: '#E8611A' }}
                          >
                            + Add to Planning
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Side drawer ──────────────────────────────────────────── */}
      {selectedEvent && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedEvent(null)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-100 shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Event Detail</span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedEvent.type && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_STYLES[selectedEvent.type]?.chip ?? 'bg-gray-100 text-gray-500'}`}>
                    {selectedEvent.type}
                  </span>
                )}
                {selectedEvent.status && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[selectedEvent.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {selectedEvent.status}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-bold text-gray-900 leading-snug">
                {selectedEvent.campaign_name ?? selectedEvent.event_name}
              </h3>

              <p className="text-sm text-gray-500">{formatDateLong(selectedEvent.date)}</p>

              {selectedEvent.region && (
                <p className="text-xs text-gray-400">📍 {selectedEvent.region}</p>
              )}

              {selectedEvent.event_name && selectedEvent.campaign_name && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                  📅 {selectedEvent.event_name}
                </div>
              )}

              {selectedEvent.incentive && (
                <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm text-orange-700">
                  🎁 {selectedEvent.incentive}
                </div>
              )}
            </div>

            {selectedEvent.campaign_name && (
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => openAddModal(selectedEvent)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: '#E8611A' }}
                >
                  + Add to Planning
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add to Planning modal ─────────────────────────────────── */}
      {showAddModal && modalEvent && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Add to Planning</h3>

            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
              {modalEvent.campaign_name}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Brand</label>
              <select
                value={planningBrandId}
                onChange={e => setPlanningBrandId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Planning Month</label>
              <select
                value={planningMonth}
                onChange={e => setPlanningMonth(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const val = `2026-${String(i + 1).padStart(2, '0')}`
                  const label = new Date(2026, i, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
                  return <option key={val} value={val}>{label}</option>
                })}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Topic Type</label>
              <div className="flex gap-2">
                {(['promotional', 'evergreen'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTopicType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                      topicType === t
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {addSuccess && (
              <p className={`text-sm rounded-lg px-3 py-2 ${addSuccess.startsWith('✓') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                {addSuccess}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAddToPlanning}
                disabled={adding}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#E8611A' }}
              >
                {adding ? 'Adding…' : 'Add to Planning'}
              </button>
              <button
                onClick={() => { setShowAddModal(false); setAddSuccess('') }}
                className="px-4 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 transition-colors"
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
