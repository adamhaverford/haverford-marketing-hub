'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { timeAgo, formatMonthLabel, getUpcomingMonths } from '@/lib/utils'
import { Check, X, Plus, Pencil, RotateCcw, Lightbulb } from 'lucide-react'

interface Brand {
  id: string
  name: string
  color: string
}

export interface Idea {
  id: string
  text: string
  brand_id: string | null
  topic_type: 'evergreen' | 'promotional' | null
  status: 'new' | 'proceeded' | 'declined'
  proceeded_to_month: string | null
  proceeded_to_topic_id: string | null
  created_by: string | null
  created_at: string
  brand_name: string | null
  brand_color: string | null
  creator_name: string | null
}

interface Props {
  initialIdeas: Idea[]
  brands: Brand[]
  currentUserId: string
  currentUserName: string
}

const UPCOMING_MONTHS = getUpcomingMonths(12)

const INPUT_CLS = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300'
const LABEL_CLS = 'text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1.5'

function topicTypeLabel(t: 'evergreen' | 'promotional' | null | undefined) {
  if (t === 'evergreen') return 'Evergreen'
  if (t === 'promotional') return 'Newsletter/Promo'
  return ''
}

export default function BrainstormClient({ initialIdeas, brands, currentUserId, currentUserName }: Props) {
  const supabase = createClient()
  const { addToast } = useToast()

  const [view, setView]   = useState<'pool' | 'archive'>('pool')
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas)

  // Add modal
  const [showAdd, setShowAdd]         = useState(false)
  const [addText, setAddText]         = useState('')
  const [addBrandId, setAddBrandId]   = useState(brands[0]?.id ?? '')
  const [addTopicType, setAddTopicType] = useState<'evergreen' | 'promotional' | ''>('')
  const [addLoading, setAddLoading]   = useState(false)

  // Proceed modal
  const [proceedingIdea, setProceedingIdea] = useState<Idea | null>(null)
  const [proceedMonth, setProceedMonth]     = useState(UPCOMING_MONTHS[0] ?? '')
  const [proceedType, setProceedType]       = useState<'evergreen' | 'promotional'>('evergreen')
  const [proceedBrandId, setProceedBrandId] = useState('')
  const [proceedLoading, setProceedLoading] = useState(false)

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const poolIdeas    = ideas.filter(i => i.status === 'new')
  const archiveIdeas = ideas.filter(i => i.status !== 'new')

  // ── Add idea ────────────────────────────────────────────────
  async function handleAdd() {
    if (!addText.trim()) return
    setAddLoading(true)
    try {
      const { data: idea, error } = await supabase
        .from('brainstorm_ideas')
        .insert({
          text:        addText.trim(),
          brand_id:    addBrandId || null,
          topic_type:  addTopicType || null,
          created_by:  currentUserId,
        })
        .select('id, text, brand_id, topic_type, status, proceeded_to_month, proceeded_to_topic_id, created_by, created_at')
        .single()

      if (error) throw error

      const brand = brands.find(b => b.id === idea.brand_id)
      setIdeas(prev => [{
        ...idea,
        brand_name:   brand?.name    ?? null,
        brand_color:  brand?.color   ?? null,
        creator_name: currentUserName,
      } as Idea, ...prev])

      setShowAdd(false)
      setAddText('')
      setAddTopicType('')
      addToast('Idea added to pool!')
    } catch {
      addToast('Failed to add idea.', 'error')
    } finally {
      setAddLoading(false)
    }
  }

  // ── Decline ─────────────────────────────────────────────────
  async function handleDecline(idea: Idea) {
    const { error } = await supabase
      .from('brainstorm_ideas')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', idea.id)

    if (error) { addToast('Failed to archive idea.', 'error'); return }
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: 'declined' as const } : i))
    addToast('Idea moved to archive.')
  }

  // ── Restore ─────────────────────────────────────────────────
  async function handleRestore(idea: Idea) {
    const { error } = await supabase
      .from('brainstorm_ideas')
      .update({ status: 'new', updated_at: new Date().toISOString() })
      .eq('id', idea.id)

    if (error) { addToast('Failed to restore idea.', 'error'); return }
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, status: 'new' as const } : i))
    addToast('Idea restored to pool.')
  }

  // ── Open proceed modal ───────────────────────────────────────
  function openProceed(idea: Idea) {
    setProceedingIdea(idea)
    setProceedMonth(UPCOMING_MONTHS[0] ?? '')
    setProceedType(idea.topic_type ?? 'evergreen')
    setProceedBrandId(idea.brand_id ?? brands[0]?.id ?? '')
  }

  // ── Confirm proceed ──────────────────────────────────────────
  async function handleProceed() {
    if (!proceedingIdea) return
    const brandId = proceedingIdea.brand_id ?? proceedBrandId
    if (!brandId) { addToast('Please select a brand.', 'error'); return }

    setProceedLoading(true)
    try {
      // Get max sort_order for target brand/month/type slot
      const { data: existing } = await supabase
        .from('planning_topics')
        .select('sort_order')
        .eq('brand_id', brandId)
        .eq('month', proceedMonth)
        .eq('type', proceedType)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()

      const sort_order = (existing?.sort_order ?? 0) + 1

      // Create planning topic
      const { data: topic, error: topicErr } = await supabase
        .from('planning_topics')
        .insert({
          brand_id:    brandId,
          month:       proceedMonth,
          type:        proceedType,
          title:       proceedingIdea.text,
          description: null,
          created_by:  currentUserId,
          status:      'proposed',
          sort_order,
        })
        .select('id')
        .single()

      if (topicErr) throw topicErr

      // Update brainstorm idea
      const { error: ideaErr } = await supabase
        .from('brainstorm_ideas')
        .update({
          status:               'proceeded',
          proceeded_to_month:   proceedMonth,
          proceeded_to_topic_id: topic.id,
          topic_type:           proceedType,
          updated_at:           new Date().toISOString(),
        })
        .eq('id', proceedingIdea.id)

      if (ideaErr) throw ideaErr

      const targetBrand = brands.find(b => b.id === brandId)
      setIdeas(prev => prev.map(i => i.id === proceedingIdea.id ? {
        ...i,
        status:               'proceeded' as const,
        proceeded_to_month:   proceedMonth,
        proceeded_to_topic_id: topic.id,
        topic_type:           proceedType,
        brand_id:             brandId,
        brand_name:           targetBrand?.name  ?? i.brand_name,
        brand_color:          targetBrand?.color ?? i.brand_color,
      } : i))

      setProceedingIdea(null)
      addToast('Idea moved to planning!')
    } catch {
      addToast('Failed to proceed idea.', 'error')
    } finally {
      setProceedLoading(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────
  async function handleEditSave(idea: Idea) {
    const trimmed = editText.trim()
    if (!trimmed || trimmed === idea.text) { setEditingId(null); return }

    setEditLoading(true)
    const { error } = await supabase
      .from('brainstorm_ideas')
      .update({ text: trimmed, updated_at: new Date().toISOString() })
      .eq('id', idea.id)

    setEditLoading(false)
    if (error) { addToast('Failed to update idea.', 'error'); return }
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, text: trimmed } : i))
    setEditingId(null)
    addToast('Idea updated.')
  }

  // ── Render ───────────────────────────────────────────────────
  function renderIdea(idea: Idea, inArchive: boolean) {
    const isOwn     = idea.created_by === currentUserId
    const isEditing = editingId === idea.id

    return (
      <div key={idea.id} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group">

        {/* Brand badge */}
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white flex-shrink-0 mt-0.5"
          style={{ backgroundColor: idea.brand_color ?? '#9CA3AF' }}
        >
          {idea.brand_name ?? 'No brand'}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditSave(idea)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 px-2.5 py-1.5 text-sm border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                onClick={() => handleEditSave(idea)}
                disabled={editLoading}
                className="text-xs px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ backgroundColor: '#E8611A' }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-900">{idea.text}</p>
          )}

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {idea.topic_type && (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {topicTypeLabel(idea.topic_type)}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {idea.creator_name ?? 'Unknown'} · {timeAgo(idea.created_at)}
            </span>
            {inArchive && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                idea.status === 'proceeded'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {idea.status === 'proceeded'
                  ? `Proceeded → ${idea.brand_name ?? ''}${idea.proceeded_to_month ? ' / ' + formatMonthLabel(idea.proceeded_to_month) : ''}${idea.topic_type ? ' / ' + topicTypeLabel(idea.topic_type) : ''}`
                  : 'Declined'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!inArchive && !isEditing && (
            <>
              {isOwn && (
                <button
                  onClick={() => { setEditingId(idea.id); setEditText(idea.text) }}
                  title="Edit"
                  className="p-1.5 text-gray-300 hover:text-gray-500 rounded-lg hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => openProceed(idea)}
                title="Proceed to planning"
                className="p-1.5 text-green-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDecline(idea)}
                title="Archive"
                className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {inArchive && idea.status === 'declined' && (
            <button
              onClick={() => handleRestore(idea)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
          )}
        </div>
      </div>
    )
  }

  const displayedIdeas = view === 'pool' ? poolIdeas : archiveIdeas

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Lightbulb className="w-6 h-6" style={{ color: '#E8611A' }} />
          <h2 className="text-2xl font-bold text-gray-900">Brainstorm</h2>
        </div>
        <p className="text-gray-500">Shared idea pool for email marketing meetings.</p>
      </div>

      {/* Tabs + Add button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setView('pool')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'pool' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pool{poolIdeas.length > 0 ? ` (${poolIdeas.length})` : ''}
          </button>
          <button
            onClick={() => setView('archive')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === 'archive' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Archive{archiveIdeas.length > 0 ? ` (${archiveIdeas.length})` : ''}
          </button>
        </div>

        {view === 'pool' && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#E8611A' }}
          >
            <Plus className="w-4 h-4" />
            Add idea
          </button>
        )}
      </div>

      {/* Idea list */}
      {displayedIdeas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-25" />
          {view === 'pool' ? (
            <>
              <p className="text-sm font-medium">No ideas in the pool yet.</p>
              <p className="text-xs mt-1">Add the first one using the button above.</p>
            </>
          ) : (
            <p className="text-sm">No archived ideas.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedIdeas.map(idea => renderIdea(idea, view === 'archive'))}
        </div>
      )}

      {/* ── Add Idea Modal ───────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Add idea</h3>
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLS}>Idea</label>
                <textarea
                  autoFocus
                  value={addText}
                  onChange={e => setAddText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAdd() }}
                  rows={3}
                  placeholder="Describe the campaign idea…"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className={LABEL_CLS}>Brand</label>
                <select value={addBrandId} onChange={e => setAddBrandId(e.target.value)} className={INPUT_CLS}>
                  <option value="">— No brand —</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>
                  Topic type hint{' '}
                  <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <select
                  value={addTopicType}
                  onChange={e => setAddTopicType(e.target.value as 'evergreen' | 'promotional' | '')}
                  className={INPUT_CLS}
                >
                  <option value="">— None —</option>
                  <option value="evergreen">Evergreen</option>
                  <option value="promotional">Newsletter/Promo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAdd(false); setAddText('') }}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!addText.trim() || addLoading}
                className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#E8611A' }}
              >
                {addLoading ? 'Adding…' : 'Add idea'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Proceed Modal ────────────────────────────────────── */}
      {proceedingIdea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Proceed to planning</h3>
            <p className="text-sm text-gray-500 mb-6 line-clamp-2 italic">
              &ldquo;{proceedingIdea.text}&rdquo;
            </p>
            <div className="space-y-4">
              {!proceedingIdea.brand_id && (
                <div>
                  <label className={LABEL_CLS}>Brand</label>
                  <select value={proceedBrandId} onChange={e => setProceedBrandId(e.target.value)} className={INPUT_CLS}>
                    <option value="">— Select brand —</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={LABEL_CLS}>Month</label>
                <select value={proceedMonth} onChange={e => setProceedMonth(e.target.value)} className={INPUT_CLS}>
                  {UPCOMING_MONTHS.map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>Topic type</label>
                <select
                  value={proceedType}
                  onChange={e => setProceedType(e.target.value as 'evergreen' | 'promotional')}
                  className={INPUT_CLS}
                >
                  <option value="evergreen">Evergreen</option>
                  <option value="promotional">Newsletter/Promo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setProceedingIdea(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceed}
                disabled={proceedLoading || (!proceedingIdea.brand_id && !proceedBrandId)}
                className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#E8611A' }}
              >
                {proceedLoading ? 'Creating…' : 'Proceed to planning'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
