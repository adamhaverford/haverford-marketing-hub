'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import BrandCard from '@/components/planning/BrandCard'

interface Brand {
  id: string
  name: string
  color: string
  description: string | null
  klaviyo_account: string | null
}

interface ScheduleEntry {
  brand_id: string
  week_date: string
  status: 'empty' | 'planned' | 'scheduled' | 'sent'
  notes: string | null
}

const STATUS_CYCLE: ScheduleEntry['status'][] = ['empty', 'planned', 'scheduled', 'sent']

const STATUS_STYLES: Record<ScheduleEntry['status'], string> = {
  empty:     'bg-gray-100 text-gray-400 hover:bg-gray-200',
  planned:   'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
  scheduled: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  sent:      'bg-green-100 text-green-700 hover:bg-green-200',
}

const STATUS_LABELS: Record<ScheduleEntry['status'], string> = {
  empty:     '—',
  planned:   'Planned',
  scheduled: 'Scheduled',
  sent:      'Sent',
}

function getUpcomingTuesdays(count: number): string[] {
  const tuesdays: string[] = []
  const d = new Date()
  // move to next Tuesday (or today if Tuesday)
  const day = d.getDay() // 0=Sun, 2=Tue
  const daysUntilTuesday = (2 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntilTuesday)
  for (let i = 0; i < count; i++) {
    tuesdays.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 7)
  }
  return tuesdays
}

function formatTuesday(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day:   d.getDate().toString(),
    month: d.toLocaleString('en-AU', { month: 'short' }),
  }
}

interface Props {
  brands: Brand[]
}

export default function PlanningIndexClient({ brands }: Props) {
  const [activeTab, setActiveTab] = useState<'brands' | 'schedule'>('brands')
  const [schedule, setSchedule] = useState<Record<string, ScheduleEntry>>({})
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  const supabase = createClient()
  const klaviyoBrands = brands.filter(b => b.klaviyo_account)
  const tuesdays = getUpcomingTuesdays(10)

  const cellKey = (brandId: string, date: string) => `${brandId}__${date}`

  const loadSchedule = useCallback(async () => {
    const { data } = await supabase
      .from('email_schedule')
      .select('brand_id, week_date, status, notes')
      .in('brand_id', klaviyoBrands.map(b => b.id))
    if (data) {
      const map: Record<string, ScheduleEntry> = {}
      for (const row of data) {
        map[cellKey(row.brand_id, row.week_date)] = row as ScheduleEntry
      }
      setSchedule(map)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTab === 'schedule') loadSchedule()
  }, [activeTab, loadSchedule])

  const cycleStatus = async (brand: Brand, date: string) => {
    const key = cellKey(brand.id, date)
    const current = schedule[key]?.status ?? 'empty'
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length]
    const notes = schedule[key]?.notes ?? null

    setSaving(key)
    if (next === 'empty') {
      await supabase.from('email_schedule').delete()
        .eq('brand_id', brand.id).eq('week_date', date)
      setSchedule(prev => {
        const updated = { ...prev }
        delete updated[key]
        return updated
      })
    } else {
      await supabase.from('email_schedule').upsert(
        { brand_id: brand.id, week_date: date, status: next, notes, updated_at: new Date().toISOString() },
        { onConflict: 'brand_id,week_date' }
      )
      setSchedule(prev => ({ ...prev, [key]: { brand_id: brand.id, week_date: date, status: next, notes } }))
    }
    setSaving(null)
  }

  const openNote = (brandId: string, date: string) => {
    const key = cellKey(brandId, date)
    setNoteValue(schedule[key]?.notes ?? '')
    setEditingCell(key)
  }

  const saveNote = async () => {
    if (!editingCell) return
    const [brandId, date] = editingCell.split('__')
    const current = schedule[editingCell]
    if (!current || current.status === 'empty') {
      setEditingCell(null)
      return
    }
    await supabase.from('email_schedule').upsert(
      { brand_id: brandId, week_date: date, status: current.status, notes: noteValue || null, updated_at: new Date().toISOString() },
      { onConflict: 'brand_id,week_date' }
    )
    setSchedule(prev => ({ ...prev, [editingCell]: { ...current, notes: noteValue || null } }))
    setEditingCell(null)
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Planning</h2>
        <p className="text-gray-500 text-sm">Manage email marketing plans and weekly send schedule.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-gray-100 rounded-xl p-1 w-fit">
        {(['brands', 'schedule'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'brands' ? 'Brands' : 'Email Schedule'}
          </button>
        ))}
      </div>

      {/* Brands tab */}
      {activeTab === 'brands' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
          {brands.map(brand => (
            <BrandCard key={brand.id} brand={brand} />
          ))}
        </div>
      )}

      {/* Schedule tab */}
      {activeTab === 'schedule' && (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 min-w-[900px]">
            <thead>
              <tr>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4 sticky left-0 bg-white z-10 w-48">
                  Brand
                </th>
                {tuesdays.map(date => {
                  const { day, month } = formatTuesday(date)
                  return (
                    <th key={date} className="text-center pb-3 px-2 min-w-[90px]">
                      <div className="text-xs font-semibold text-gray-900">{day}</div>
                      <div className="text-xs text-gray-400 font-normal">{month}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {klaviyoBrands.map((brand, i) => (
                <tr key={brand.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  {/* Brand name cell */}
                  <td className={`sticky left-0 z-10 pr-4 py-2 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: brand.color }} />
                      <span className="text-sm font-medium text-gray-800 truncate">{brand.name}</span>
                    </div>
                  </td>
                  {/* Week cells */}
                  {tuesdays.map(date => {
                    const key = cellKey(brand.id, date)
                    const entry = schedule[key]
                    const status = entry?.status ?? 'empty'
                    const isSaving = saving === key
                    return (
                      <td key={date} className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => cycleStatus(brand, date)}
                            disabled={isSaving}
                            className={`text-xs font-medium px-2 py-1 rounded-lg w-full transition-all ${STATUS_STYLES[status]} ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                          >
                            {STATUS_LABELS[status]}
                          </button>
                          {status !== 'empty' && (
                            <button
                              onClick={() => openNote(brand.id, date)}
                              className="text-[10px] text-gray-400 hover:text-gray-600 truncate max-w-[80px] text-center leading-tight"
                              title={entry?.notes ?? 'Add note'}
                            >
                              {entry?.notes ? entry.notes : '+ note'}
                            </button>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-6">
            <span className="text-xs text-gray-400 font-medium">Click to cycle status:</span>
            {STATUS_CYCLE.filter(s => s !== 'empty').map(s => (
              <span key={s} className={`text-xs font-medium px-2 py-0.5 rounded-md ${STATUS_STYLES[s]}`}>
                {STATUS_LABELS[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Note modal */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditingCell(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Note</h3>
            <textarea
              autoFocus
              value={noteValue}
              onChange={e => setNoteValue(e.target.value)}
              placeholder="e.g. Repurposing EDM0023 — Cat Tunnels"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setEditingCell(null)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg">
                Cancel
              </button>
              <button onClick={saveNote} className="px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
