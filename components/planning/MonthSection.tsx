'use client'

import { useState, useTransition, useEffect } from 'react'
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

interface Comment {
  id: string
  comment: string
  created_at: string
  profiles: { full_name: string | null } | null
}

interface Topic {
  id: string
  title: string
  description: string | null
  status: 'proposed' | 'approved' | 'declined'
  created_at: string
  action_comment: string | null
  actioned_at: string | null
  profiles: { full_name: string | null } | null
  actioned_by_profile: { full_name: string | null } | null
  comments: Comment[]
}

interface Design {
  id: string
  file_url: string | null
  uploaded_at: string
  status: 'pending' | 'approved' | 'declined'
  is_current: boolean
  actioned_at: string | null
  uploaded_by_profile: { full_name: string | null } | null
  actioned_by_profile: { full_name: string | null } | null
  comments: Comment[]
}

interface MonthSectionProps {
  brandId: string
  month: string
  type: 'evergreen' | 'promotional'
  topics: Topic[]
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

export default function MonthSection({ brandId, month, type, topics, designs, role }: MonthSectionProps) {
  const [showAddTopic, setShowAddTopic] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [orderedTopics, setOrderedTopics] = useState(topics)
  const [isPending, startTransition] = useTransition()

  // Sync when server data changes after revalidation
  useEffect(() => { setOrderedTopics(topics) }, [topics])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrderedTopics(prev => {
      const oldIndex = prev.findIndex(t => t.id === active.id)
      const newIndex = prev.findIndex(t => t.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      startTransition(async () => {
        await reorderTopics(reordered.map(t => t.id))
      })
      return reordered
    })
  }

  function handleDeleteTopic(topicId: string) {
    setOrderedTopics(prev => prev.filter(t => t.id !== topicId))
  }

  function handleAddTopic() {
    if (!title.trim()) return
    const t = title
    const d = description
    setTitle('')
    setDescription('')
    setShowAddTopic(false)
    startTransition(async () => {
      await addTopic({ brand_id: brandId, month, type, title: t, description: d || null })
    })
  }

  const typeLabel = type === 'evergreen' ? 'Evergreen' : 'Promo/Newsletter'
  const sectionColor = type === 'evergreen' ? 'bg-teal-50 border-teal-200' : 'bg-purple-50 border-purple-200'
  const headerColor = type === 'evergreen' ? 'text-teal-700' : 'text-purple-700'
  const accentColor = type === 'evergreen' ? '#0d9488' : '#9333ea'

  return (
    <div className={`rounded-2xl border-2 ${sectionColor} overflow-hidden`}>
      {/* Section header */}
      <div className={`px-6 py-4 border-b ${type === 'evergreen' ? 'border-teal-200' : 'border-purple-200'} bg-white/60`}>
        <h3 className={`text-base font-bold ${headerColor}`}>{typeLabel}</h3>
      </div>

      <div className="p-6 space-y-6">
        {/* Part A: Topic Pool */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Topics</h4>
            <button
                onClick={() => setShowAddTopic(!showAddTopic)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: accentColor }}
              >
                {showAddTopic ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {showAddTopic ? 'Cancel' : 'Add Topic'}
              </button>
          </div>

          {/* Add topic form */}
          {showAddTopic && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 mb-3 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddTopic()}
                  placeholder="Topic title..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notes / Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Angle, key products, context..."
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddTopic}
                  disabled={!title.trim() || isPending}
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors hover:opacity-90"
                  style={{ backgroundColor: accentColor }}
                >
                  {isPending ? 'Adding...' : 'Add Topic'}
                </button>
                <button
                  onClick={() => { setShowAddTopic(false); setTitle(''); setDescription('') }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {orderedTopics.length === 0 && !showAddTopic ? (
            <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
              No topics yet.
              <span className="ml-1 text-gray-500">Click + Add Topic to get started.</span>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedTopics.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedTopics.map((topic, i) => (
                    <TopicRow key={topic.id} topic={topic} role={role} number={i + 1} onDelete={handleDeleteTopic} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        {/* Part B: Design Review */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Design</h4>
          </div>
          <DesignReview
            brandId={brandId}
            month={month}
            type={type}
            designs={designs}
            role={role}
          />
        </div>
      </div>
    </div>
  )
}
