'use client'

import { useState, useTransition, useRef } from 'react'
import { Upload, Check, X, MessageCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react'
import { setDesignStatus, addDesignComment, uploadDesign } from '@/lib/actions/planning'
import { createClient } from '@/lib/supabase/client'
import { timeAgo, formatDatetime } from '@/lib/utils'

interface Comment {
  id: string
  comment: string
  created_at: string
  profiles: { full_name: string | null } | null
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

interface DesignReviewProps {
  brandId: string
  month: string
  type: 'evergreen' | 'promotional'
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

function CommentThread({ comments, designId }: { comments: Comment[]; designId: string }) {
  const [commentText, setCommentText] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleAddComment() {
    if (!commentText.trim()) return
    const text = commentText
    setCommentText('')
    startTransition(async () => { await addDesignComment(designId, text) })
  }

  return (
    <div className="space-y-2">
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map(c => (
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
  )
}

function DesignCard({ design, role }: { design: Design; role: 'marketing' | 'stakeholder' }) {
  const [showComments, setShowComments] = useState(false)
  const [showDeclineInput, setShowDeclineInput] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [isPending, startTransition] = useTransition()
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const isApproved = design.status === 'approved'
  const isDeclined = design.status === 'declined'
  const canAct = role === 'stakeholder' && design.is_current

  function handleApprove() {
    if (!canAct) return
    startTransition(async () => {
      await setDesignStatus(design.id, isApproved ? 'pending' : 'approved')
    })
  }

  function handleDeclineSubmit() {
    if (!canAct) return
    startTransition(async () => {
      await setDesignStatus(design.id, 'declined')
      setShowDeclineInput(false)
      setDeclineReason('')
    })
  }

  function handleUndecline() {
    if (!canAct) return
    startTransition(async () => { await setDesignStatus(design.id, 'pending') })
  }

  const borderClass = isApproved
    ? 'border-green-200 bg-green-50/20'
    : isDeclined
    ? 'border-red-100 bg-red-50/20'
    : 'border-gray-200 bg-white'

  return (
    <div className={`rounded-xl border p-4 ${borderClass} ${!design.is_current && isDeclined ? 'opacity-60' : ''}`}>
      {!design.is_current && (
        <span className="inline-block text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 mb-2 font-medium">
          Previous version
        </span>
      )}

      <div className="flex gap-4">
        {/* Thumbnail */}
        <div
          className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => design.file_url && setLightboxOpen(true)}
        >
          {design.file_url ? (
            <img src={design.file_url} alt="Design preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700">
            Uploaded by <span className="font-medium">{design.uploaded_by_profile?.full_name ?? 'Unknown'}</span>
          </p>
          <p className="text-xs text-gray-400" title={design.uploaded_at}>{timeAgo(design.uploaded_at)}</p>

          {/* Audit trail — approved */}
          {isApproved && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Approved by <span className="font-semibold">{design.actioned_by_profile?.full_name ?? 'Unknown'}</span>
                {design.actioned_at && <> · {formatDatetime(design.actioned_at)}</>}
              </span>
            </div>
          )}

          {/* Audit trail — declined */}
          {isDeclined && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                Declined by <span className="font-semibold">{design.actioned_by_profile?.full_name ?? 'Unknown'}</span>
                {design.actioned_at && <> · {formatDatetime(design.actioned_at)}</>}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons — visible to all, interactive for stakeholder on current design only */}
        <div className="flex items-start gap-2 flex-shrink-0">
          <button
            onClick={handleApprove}
            disabled={isPending || isDeclined || !canAct}
            title={
              !role || role !== 'stakeholder' ? 'Only stakeholders can approve designs'
              : !design.is_current ? 'Only the current version can be actioned'
              : isApproved ? 'Undo approval'
              : 'Approve design'
            }
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
              !canAct
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : isApproved
                ? 'border-green-500 bg-green-500 text-white hover:bg-green-600 disabled:opacity-40'
                : 'border-gray-200 text-gray-400 hover:border-green-400 hover:text-green-500 hover:bg-green-50 disabled:opacity-40'
            }`}
          >
            <Check className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (!canAct) return
              if (isDeclined) handleUndecline()
              else setShowDeclineInput(!showDeclineInput)
            }}
            disabled={isPending || isApproved || !canAct}
            title={
              role !== 'stakeholder' ? 'Only stakeholders can decline designs'
              : !design.is_current ? 'Only the current version can be actioned'
              : isDeclined ? 'Undo decline'
              : 'Decline design'
            }
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
              !canAct
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : isDeclined
                ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 disabled:opacity-40'
                : 'border-gray-200 text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40'
            }`}
          >
            <X className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {design.comments.length > 0 && <span className="font-medium">{design.comments.length}</span>}
            {showComments ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

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
          <button onClick={handleDeclineSubmit} disabled={isPending}
            className="px-3 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors">
            Decline
          </button>
          <button onClick={() => { setShowDeclineInput(false); setDeclineReason('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
        </div>
      )}

      {showComments && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <CommentThread comments={design.comments} designId={design.id} />
        </div>
      )}

      {lightboxOpen && design.file_url && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <img src={design.file_url} alt="Design full size" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors" onClick={() => setLightboxOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

export default function DesignReview({ brandId, month, type, designs, role }: DesignReviewProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentDesign = designs.find(d => d.is_current) ?? null
  const historyDesigns = designs.filter(d => !d.is_current && d.status === 'declined')
  const showUploadButton = role === 'marketing' && (!currentDesign || currentDesign.status === 'declined')

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const path = `${brandId}/${month}/${type}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { data, error } = await supabase.storage.from('planning-designs').upload(path, file, { upsert: false })
      if (error) throw new Error(error.message)
      const { data: { publicUrl } } = supabase.storage.from('planning-designs').getPublicUrl(data.path)
      startTransition(async () => {
        await uploadDesign({ brand_id: brandId, month, type, file_url: publicUrl })
      })
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {!currentDesign && !uploading && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center gap-2 text-center">
          <ImageIcon className="w-8 h-8 text-gray-300" />
          <p className="text-sm text-gray-500">No design uploaded yet</p>
        </div>
      )}

      {currentDesign && <DesignCard design={currentDesign} role={role} />}

      {showUploadButton && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#E8611A' }}
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : currentDesign ? 'Upload revised design' : 'Upload Design'}
          </button>
          {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        </div>
      )}

      {historyDesigns.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Previous versions</p>
          {historyDesigns.map(d => <DesignCard key={d.id} design={d} role={role} />)}
        </div>
      )}
    </div>
  )
}
