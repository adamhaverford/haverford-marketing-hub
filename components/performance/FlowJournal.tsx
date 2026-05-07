'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronUp, BookOpen } from 'lucide-react'
import { getJournalEntries, addJournalEntry, updateJournalOutcome, deleteJournalEntry, JournalEntry } from '@/lib/actions/journal'

const CATEGORIES = ['Subject Line', 'Copy', 'Delay', 'Filter', 'Structure', 'Split Test', 'Other'] as const

const CATEGORY_COLORS: Record<string, string> = {
  'Subject Line': 'bg-blue-100 text-blue-700',
  'Copy':         'bg-purple-100 text-purple-700',
  'Delay':        'bg-amber-100 text-amber-700',
  'Filter':       'bg-teal-100 text-teal-700',
  'Structure':    'bg-orange-100 text-orange-700',
  'Split Test':   'bg-pink-100 text-pink-700',
  'Other':        'bg-gray-100 text-gray-600',
}

const OUTCOME_CONFIG = {
  improved: { label: '👍 Improved', color: 'bg-green-100 text-green-700 border-green-200' },
  neutral:  { label: '➡️ Neutral',  color: 'bg-gray-100 text-gray-600 border-gray-200'  },
  worse:    { label: '👎 Worse',    color: 'bg-red-100 text-red-700 border-red-200'      },
}

interface Flow {
  id: string
  name: string
}

interface Props {
  brandId: string
  klaviyoAccount: string
}

export default function FlowJournal({ brandId, klaviyoAccount }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [flows, setFlows] = useState<Flow[]>([])
  const [, setLoadingFlows] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const [formFlowId, setFormFlowId] = useState('')
  const [formDate, setFormDate] = useState(today)
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0])
  const [formDescription, setFormDescription] = useState('')
  const [formBefore, setFormBefore] = useState('')
  const [formAfter, setFormAfter] = useState('')
  const [formNotes, setFormNotes] = useState('')

  useEffect(() => {
    async function loadFlows() {
      setLoadingFlows(true)
      try {
        const res = await fetch('/api/klaviyo-flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: klaviyoAccount, year: new Date().getFullYear() }),
        })
        const data = await res.json()
        const flowList: Flow[] = (data.flows ?? [])
          .filter((f: { id: string; name: string }) => f.id && f.name)
          .map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))
        setFlows(flowList.sort((a, b) => a.name.localeCompare(b.name)))
      } catch (e) {
        console.error('Failed to load flows', e)
      } finally {
        setLoadingFlows(false)
      }
    }
    loadFlows()
  }, [klaviyoAccount])

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const data = await getJournalEntries(brandId)
      setEntries(data)
    } catch (e) {
      console.error('Failed to load journal entries', e)
    } finally {
      setLoadingEntries(false)
    }
  }, [brandId])

  useEffect(() => { loadEntries() }, [loadEntries])

  function resetForm() {
    setFormFlowId('')
    setFormDate(today)
    setFormCategory(CATEGORIES[0])
    setFormDescription('')
    setFormBefore('')
    setFormAfter('')
    setFormNotes('')
  }

  async function handleSave() {
    if (!formFlowId || !formDate || !formDescription.trim()) return
    setSaving(true)
    try {
      const flow = flows.find(f => f.id === formFlowId)
      await addJournalEntry({
        brand_id: brandId,
        flow_id: formFlowId,
        flow_name: flow?.name ?? formFlowId,
        changed_at: formDate,
        category: formCategory,
        description: formDescription.trim(),
        before_value: formBefore.trim() || null,
        after_value: formAfter.trim() || null,
        notes: formNotes.trim() || null,
      })
      await loadEntries()
      setShowForm(false)
      resetForm()
    } catch (e) {
      console.error('Failed to save entry', e)
    } finally {
      setSaving(false)
    }
  }

  async function handleOutcome(entryId: string, outcome: 'improved' | 'worse' | 'neutral' | null) {
    await updateJournalOutcome(entryId, outcome)
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, outcome } : e))
  }

  async function handleDelete(entryId: string) {
    if (!confirm('Delete this journal entry?')) return
    await deleteJournalEntry(entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm() }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#E8611A' }}
        >
          {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'Log Change'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-700">Log a Flow Change</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Flow *</label>
              <select
                value={formFlowId}
                onChange={e => setFormFlowId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <option value="">Select a flow...</option>
                {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Date of change *</label>
              <input
                type="date"
                value={formDate}
                onChange={e => setFormDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Category *</label>
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">What changed? *</label>
            <textarea
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="e.g. Updated subject line on email 2 to add urgency"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Before (optional)</label>
              <input
                type="text"
                value={formBefore}
                onChange={e => setFormBefore(e.target.value)}
                placeholder="Previous value..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">After (optional)</label>
              <input
                type="text"
                value={formAfter}
                onChange={e => setFormAfter(e.target.value)}
                placeholder="New value..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Notes (optional)</label>
            <textarea
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="Why was this changed? Any context or hypothesis..."
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!formFlowId || !formDate || !formDescription.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
              style={{ backgroundColor: '#E8611A' }}
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
            <button
              onClick={() => { setShowForm(false); resetForm() }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Entries list */}
      {loadingEntries ? (
        <div className="text-sm text-gray-400 text-center py-8">Loading journal...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No changes logged yet</p>
          <p className="text-xs mt-1">Hit Log Change to start tracking flow changes and their impact</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS['Other']}`}>
                    {entry.category}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate">{entry.flow_name}</span>
                  <span className="text-xs text-gray-400">· {formatDate(entry.changed_at)}</span>
                  {entry.outcome && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${OUTCOME_CONFIG[entry.outcome].color}`}>
                      {OUTCOME_CONFIG[entry.outcome].label}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 flex-shrink-0 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-700">{entry.description}</p>

              {/* Before / After */}
              {(entry.before_value || entry.after_value) && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                  {entry.before_value && <span className="line-through text-gray-400">{entry.before_value}</span>}
                  {entry.before_value && entry.after_value && <span>→</span>}
                  {entry.after_value && <span className="font-medium text-gray-700">{entry.after_value}</span>}
                </div>
              )}

              {/* Notes */}
              {entry.notes && (
                <p className="text-xs text-gray-400 italic">{entry.notes}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                <span className="text-xs text-gray-400">
                  Logged by {entry.profiles?.full_name ?? 'Unknown'}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 mr-1">Outcome:</span>
                  {(['improved', 'neutral', 'worse'] as const).map(o => (
                    <button
                      key={o}
                      onClick={() => handleOutcome(entry.id, entry.outcome === o ? null : o)}
                      className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                        entry.outcome === o
                          ? OUTCOME_CONFIG[o].color
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                      }`}
                    >
                      {OUTCOME_CONFIG[o].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
