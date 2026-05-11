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
import { JPT_MONTHLY_THEMES } from '@/lib/jpt-newsletter-framework'
import type { Topic, Design } from './MonthSection'

const FRAMEWORK_SECTIONS = [
  {
    id: 'subject_line',
    label: '📧 Subject Line',
    description: 'Subject line ideas and preview text options',
    placeholder: "e.g. Matt from Penrith built this garage setup in a weekend",
    tip: 'Test: would you open this from a mate?',
  },
  {
    id: 'hero',
    label: '1. Hero',
    description: 'Lead story — customer feature, seasonal campaign, or product launch',
    placeholder: "e.g. Customer feature: Matt's winter garage transformation",
    tip: 'Strongest content first. One high-impact story.',
  },
  {
    id: 'crosssell',
    label: '2. Cross-Sell',
    description: 'Product tile ideas — 2-3 products that complement what readers own',
    placeholder: "e.g. Stealth 3×18 socket tray — every socket sorted",
    tip: "Rotate categories. Don't always push roll cabinets.",
  },
  {
    id: 'tip',
    label: '3. Workshop Tip',
    description: 'Practical how-to content sourced from reviews and support tickets',
    placeholder: "e.g. How to install a pegboard on a plaster wall",
    tip: 'Source from top 5 support questions this month.',
  },
  {
    id: 'spotlight',
    label: '4. Customer Spotlight',
    description: 'Real customer + workshop photo from Judge.me photo reviews',
    placeholder: "e.g. Dave from Brisbane — 54\" roll cabinet + matching chest",
    tip: 'Mine the 70 photo reviews. Real garages convert.',
  },
] as const

type SectionId = typeof FRAMEWORK_SECTIONS[number]['id']

interface SectionState {
  topics: Topic[]
}

interface Props {
  brandId: string
  month: string
  topics: Topic[]
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

export default function JPTFrameworkSection({ brandId, month, topics, designs, role }: Props) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    new Set(['subject_line', 'hero', 'crosssell', 'tip', 'spotlight'])
  )
  const [addingTo, setAddingTo] = useState<SectionId | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sectionTopicOrders, setSectionTopicOrders] = useState<Record<string, Topic[]>>({})

  const theme = JPT_MONTHLY_THEMES[month]

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
      {/* Monthly theme banner */}
      {theme && (
        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-purple-100">
          <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">This month</span>
          <span className="text-sm font-semibold text-gray-800">{theme.theme}</span>
          <span className="text-xs text-gray-400 ml-auto hidden sm:block">{theme.heroSuggestion}</span>
        </div>
      )}

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
      {FRAMEWORK_SECTIONS.map(section => {
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
