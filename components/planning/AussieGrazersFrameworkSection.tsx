'use client'

import { useState, useTransition } from 'react'
import { Plus, ChevronUp } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import TopicRow from './TopicRow'
import DesignReview from './DesignReview'
import { addTopic, reorderTopics } from '@/lib/actions/planning'
import { AUSSIE_GRAZERS_SECTIONS } from '@/lib/aussie-grazers-framework'
import type { Topic, Design } from './MonthSection'

type SectionId = typeof AUSSIE_GRAZERS_SECTIONS[number]['id']

interface Props {
  brandId: string
  month: string
  topics: Topic[]
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

export default function AussieGrazersFrameworkSection({ brandId, month, topics, designs, role }: Props) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set<SectionId>(['intro', 'education_tips', 'did_you_know', 'customer_review', 'horse_of_month', 'upcoming_events', 'misc'])
  )
  const [addingTo, setAddingTo] = useState<SectionId | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sectionTopicOrders, setSectionTopicOrders] = useState<Record<string, Topic[]>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function topicsForSection(sectionId: SectionId): Topic[] {
    const override = sectionTopicOrders[sectionId]
    const base = topics.filter(t => t.section === sectionId && !deletedIds.has(t.id))
    if (override) {
      const ordered = override.filter(t => !deletedIds.has(t.id) && base.some(b => b.id === t.id))
      const missing = base.filter(t => !ordered.some(o => o.id === t.id))
      return [...ordered, ...missing]
    }
    return base
  }

  const unassignedTopics = topics.filter(t => !t.section && !deletedIds.has(t.id))

  function handleDragEnd(sectionId: SectionId, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = topicsForSection(sectionId)
    const oldIndex = current.findIndex(t => t.id === active.id)
    const newIndex = current.findIndex(t => t.id === over.id)
    const reordered = arrayMove(current, oldIndex, newIndex)
    setSectionTopicOrders(prev => ({ ...prev, [sectionId]: reordered }))
    startTransition(async () => {
      await reorderTopics(reordered.map(t => t.id))
    })
  }

  function handleAdd(sectionId: SectionId) {
    if (!newTitle.trim()) return
    const t = newTitle
    const d = newDescription
    setNewTitle('')
    setNewDescription('')
    setAddingTo(null)
    startTransition(async () => {
      await addTopic({
        brand_id: brandId,
        month,
        type: 'promotional',
        title: t,
        description: d || null,
        section: sectionId,
      })
    })
  }

  function toggleSection(sectionId: SectionId) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  return (
    <div className="p-6 space-y-4">
      {/* Unassigned topics (added in standard mode) */}
      {unassignedTopics.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700 mb-2">⚠️ Topics without a section (added in Standard Mode)</p>
          <div className="space-y-2">
            {unassignedTopics.map((topic, i) => (
              <DndContext key={topic.id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={() => {}}>
                <SortableContext items={[topic.id]} strategy={verticalListSortingStrategy}>
                  <TopicRow
                    topic={topic}
                    role={role}
                    number={i + 1}
                    onDelete={id => setDeletedIds(prev => new Set(prev).add(id))}
                  />
                </SortableContext>
              </DndContext>
            ))}
          </div>
        </div>
      )}

      {/* Framework sections */}
      {AUSSIE_GRAZERS_SECTIONS.map(section => {
        const sectionTopics = topicsForSection(section.id)
        const isOpen = openSections.has(section.id)
        const isAdding = addingTo === section.id

        return (
          <div key={section.id} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            {/* Section header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">{section.label}</span>
                {sectionTopics.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">
                    {sectionTopics.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                {role === 'marketing' && (
                  <button
                    onClick={() => {
                      if (!openSections.has(section.id)) {
                        setOpenSections(prev => new Set(prev).add(section.id))
                      }
                      setAddingTo(isAdding ? null : section.id)
                      setNewTitle('')
                      setNewDescription('')
                    }}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#9333ea' }}
                  >
                    {isAdding ? <ChevronUp className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    Add
                  </button>
                )}
                <ChevronUp
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? '' : 'rotate-180'}`}
                />
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 pt-3 italic">{section.description}</p>
                {section.tip && (
                  <p className="text-xs text-purple-500 bg-purple-50 rounded-lg px-3 py-2">
                    💡 {section.tip}
                  </p>
                )}

                {/* Add form */}
                {isAdding && (
                  <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3 space-y-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAdd(section.id)}
                      placeholder={section.placeholder}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                    />
                    <textarea
                      value={newDescription}
                      onChange={e => setNewDescription(e.target.value)}
                      placeholder="Notes, angle, context... (optional)"
                      rows={2}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none bg-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAdd(section.id)}
                        disabled={!newTitle.trim() || isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90"
                        style={{ backgroundColor: '#9333ea' }}
                      >
                        {isPending ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        onClick={() => { setAddingTo(null); setNewTitle(''); setNewDescription('') }}
                        className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Topics with DnD */}
                {sectionTopics.length === 0 && !isAdding ? (
                  <p className="text-xs text-gray-400 italic py-2 text-center">
                    No ideas yet — hit Add to get started
                  </p>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={event => handleDragEnd(section.id, event)}
                  >
                    <SortableContext items={sectionTopics.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {sectionTopics.map((topic, i) => (
                          <TopicRow
                            key={topic.id}
                            topic={topic}
                            role={role}
                            number={i + 1}
                            onDelete={id => setDeletedIds(prev => new Set(prev).add(id))}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Design upload — always at bottom */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Design</h4>
        <DesignReview
          brandId={brandId}
          month={month}
          type="promotional"
          designs={designs}
          role={role}
        />
      </div>
    </div>
  )
}
