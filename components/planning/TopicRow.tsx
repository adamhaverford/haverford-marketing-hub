'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Check, X, MessageCircle, ChevronDown, ChevronUp, Pencil, Trash2, AlertTriangle, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { setTopicStatus, addTopicComment, updateTopic, deleteTopic } from '@/lib/actions/planning'
import { timeAgo, formatDatetime } from '@/lib/utils'

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

interface TopicRowProps {
  topic: Topic
  role: 'marketing' | 'stakeholder'
  number: number
  onDelete: (id: string) => void
}

export default function TopicRow({ topic, role, number, onDelete }: TopicRowProps) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineInput, setShowDeclineInput] = useState(false)
  const [highlighted, setHighlighted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(topic.title)
  const [editDescription, setEditDescription] = useState(topic.description ?? '')
  const [isPending, startTransition] = useTransition()
  const commentInputRef = useRef<HTMLTextAreaElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: topic.id })

  function mergeRef(node: HTMLDivElement | null) {
    setNodeRef(node)
    rowRef.current = node
  }
  const isDeclined = topic.status === 'declined'
  const isApproved = topic.status === 'approved'
  const canAct = role === 'stakeholder'
  const willResetOnSave = role === 'stakeholder' && (isApproved || isDeclined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('highlight') !== `topic-${topic.id}`) return
    setShowComments(true)
    setHighlighted(true)
    setTimeout(() => rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }, [topic.id])

  function startEditing() {
    setEditTitle(topic.title)
    setEditDescription(topic.description ?? '')
    setIsEditing(true)
    setTimeout(() => editTitleRef.current?.focus(), 50)
  }

  function handleDelete() {
    if (!confirm('Delete this topic? This cannot be undone.')) return
    onDelete(topic.id) // optimistic remove
    startTransition(async () => {
      await deleteTopic(topic.id)
    })
  }

  function cancelEditing() {
    setIsEditing(false)
    setEditTitle(topic.title)
    setEditDescription(topic.description ?? '')
  }

  function handleSave() {
    if (!editTitle.trim()) return
    startTransition(async () => {
      await updateTopic(topic.id, editTitle, editDescription || null)
      setIsEditing(false)
    })
  }

  function handleApprove() {
    if (!canAct) return
    startTransition(async () => {
      await setTopicStatus(topic.id, isApproved ? 'proposed' : 'approved')
    })
  }

  function handleDeclineSubmit() {
    if (!canAct) return
    startTransition(async () => {
      await setTopicStatus(topic.id, 'declined', declineReason)
      setShowDeclineInput(false)
      setDeclineReason('')
    })
  }

  function handleUndecline() {
    if (!canAct) return
    startTransition(async () => {
      await setTopicStatus(topic.id, 'proposed')
    })
  }

  function handleAddComment() {
    if (!commentText.trim()) return
    const text = commentText
    setCommentText('')
    startTransition(async () => {
      await addTopicComment(topic.id, text)
    })
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <div
      ref={mergeRef}
      style={style}
      className={`rounded-xl border p-4 transition-colors ${
        isDeclined
          ? 'border-red-100 bg-red-50/30 opacity-70'
          : isApproved
          ? 'border-green-100 bg-green-50/20'
          : 'border-gray-200 bg-white'
      }${highlighted ? ' comment-highlight' : ''}`}
    >
      <div className="flex gap-2">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 p-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors"
          title="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Main content */}
        <div className="flex-1 flex gap-4">
        {/* Left: topic content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              {willResetOnSave && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>You reviewed this topic — editing will reset the approval status back to proposed</span>
                </div>
              )}
              <input
                ref={editTitleRef}
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave() }
                  if (e.key === 'Escape') cancelEditing()
                }}
                placeholder="Topic title..."
                className="w-full text-sm font-semibold px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <textarea
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') cancelEditing() }}
                placeholder="Notes / description (optional)..."
                rows={2}
                className="w-full text-sm px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none text-gray-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!editTitle.trim() || isPending}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-1.5 group/title">
                <p className={`font-semibold text-gray-900 flex-1 ${isDeclined ? 'line-through text-gray-500' : ''}`}>
                  <span className="text-gray-400 font-bold mr-1">{number}.</span>{topic.title}
                </p>
                <button
                  onClick={startEditing}
                  title="Edit topic"
                  className="mt-0.5 p-1 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 flex-shrink-0 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                {role === 'marketing' && (
                  <button
                    onClick={handleDelete}
                    title="Delete topic"
                    className="mt-0.5 p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 flex-shrink-0 transition-colors opacity-30 group-hover/title:opacity-100"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {topic.description && (
                <p className={`text-sm mt-1 break-all ${isDeclined ? 'text-gray-400' : 'text-gray-500'}`}>
                  {topic.description}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1.5">
                Added by {topic.profiles?.full_name ?? 'Unknown'} · <span title={topic.created_at}>{timeAgo(topic.created_at)}</span>
              </p>

              {/* Audit trail — approved */}
              {isApproved && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                  <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Approved by <span className="font-semibold">{topic.actioned_by_profile?.full_name ?? 'Unknown'}</span>
                    {topic.actioned_at && <> · {formatDatetime(topic.actioned_at)}</>}
                  </span>
                </div>
              )}

              {/* Audit trail — declined */}
              {isDeclined && (
                <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    Declined by <span className="font-semibold">{topic.actioned_by_profile?.full_name ?? 'Unknown'}</span>
                    {topic.actioned_at && <> · {formatDatetime(topic.actioned_at)}</>}
                    {topic.action_comment && <> — {topic.action_comment}</>}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: actions */}
        {!isEditing && (
          <div className="flex items-start gap-2 flex-shrink-0">
            {/* Approve button */}
            <button
              onClick={handleApprove}
              disabled={isPending || isDeclined || !canAct}
              title={
                !canAct ? 'Only stakeholders can approve topics'
                : isApproved ? 'Undo approval'
                : 'Approve topic'
              }
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                !canAct
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : isApproved
                  ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 hover:border-green-600 disabled:opacity-40'
                  : 'border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-500 hover:bg-green-50 disabled:opacity-40'
              }`}
            >
              <Check className="w-4 h-4" />
            </button>

            {/* Decline button */}
            <button
              onClick={() => {
                if (!canAct) return
                if (isDeclined) handleUndecline()
                else setShowDeclineInput(!showDeclineInput)
              }}
              disabled={isPending || isApproved || !canAct}
              title={
                !canAct ? 'Only stakeholders can decline topics'
                : isDeclined ? 'Undo decline'
                : 'Decline topic'
              }
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                !canAct
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : isDeclined
                  ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600 disabled:opacity-40'
                  : 'border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Comment toggle */}
            <button
              onClick={() => {
                setShowComments(!showComments)
                if (!showComments) setTimeout(() => commentInputRef.current?.focus(), 100)
              }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              {topic.comments.length > 0 && (
                <span className="font-medium">{topic.comments.length}</span>
              )}
              {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        )}
        </div>{/* end flex-1 flex gap-4 */}
      </div>{/* end flex gap-2 */}

      {/* Decline reason input (stakeholder only) */}
      {showDeclineInput && canAct && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDeclineSubmit()}
            placeholder="Reason for declining (optional)..."
            className="flex-1 text-sm px-3 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
            autoFocus
          />
          <button
            onClick={handleDeclineSubmit}
            disabled={isPending}
            className="px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => { setShowDeclineInput(false); setDeclineReason('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Comments section */}
      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {topic.comments.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No comments yet.</p>
          ) : (
            <div className="space-y-2">
              {topic.comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {(c.profiles?.full_name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">{c.profiles?.full_name ?? 'Unknown'}</span>
                      <span className="text-xs text-gray-400" title={c.created_at}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{c.comment}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() }
              }}
              placeholder="Add a comment..."
              rows={1}
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            />
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim() || isPending}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
