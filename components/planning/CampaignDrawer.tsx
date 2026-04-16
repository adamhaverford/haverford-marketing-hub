'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import {
  X,
  Loader2,
  Upload,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  advanceStatus,
  approveCampaign,
  createDesignReview,
  declineCampaign,
  reviewDesign,
  submitForApproval,
  updateCampaign,
} from '@/lib/actions/planning'
import { useToast } from '@/components/Toast'

interface Brand {
  id: string
  name: string
  color: string
}

interface Approval {
  id: string
  action: string
  comment: string | null
  actioned_at: string
  profiles: { full_name: string } | null
}

interface DesignReview {
  id: string
  image_url: string
  status: string
  stakeholder_comment: string | null
  uploaded_at: string
  reviewed_at: string | null
  profiles_uploaded: { full_name: string } | null
  profiles_reviewed: { full_name: string } | null
}

interface Campaign {
  id: string
  brand_id: string
  title: string
  type: string
  month: string | null
  status: string
  subject_line: string | null
  preview_text: string | null
  notes: string | null
  brands: { id: string; name: string; color: string } | null
  approvals: Approval[]
  design_reviews: DesignReview[]
}

interface Props {
  campaignId: string
  brands: Brand[]
  role: string
  onClose: () => void
}

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  proposed: 'Proposed',
  approved: 'Approved',
  declined: 'Declined',
  in_production: 'In Production',
  scheduled: 'Scheduled',
  sent: 'Sent',
}

const STATUS_COLORS: Record<string, string> = {
  idea: 'bg-gray-100 text-gray-700',
  proposed: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  sent: 'bg-teal-100 text-teal-700',
}

const STATUS_ADVANCE: Record<string, string> = {
  approved: 'in_production',
  in_production: 'scheduled',
  scheduled: 'sent',
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] focus:border-transparent'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function toMonthInput(dateStr: string | null) {
  if (!dateStr) return ''
  return dateStr.slice(0, 7)
}

function formatMonth(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default function CampaignDrawer({ campaignId, brands, role, onClose }: Props) {
  const { addToast } = useToast()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [approvalComment, setApprovalComment] = useState('')
  const [designComment, setDesignComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [uploadingDesign, setUploadingDesign] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchCampaign = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('campaigns')
      .select(`
        id, brand_id, title, type, month, status,
        subject_line, preview_text, notes,
        brands (id, name, color),
        approvals (
          id, action, comment, actioned_at,
          profiles!actioned_by (full_name)
        ),
        design_reviews (
          id, image_url, status, stakeholder_comment,
          uploaded_at, reviewed_at,
          profiles!uploaded_by (full_name),
          profiles!reviewed_by (full_name)
        )
      `)
      .eq('id', campaignId)
      .order('actioned_at', { referencedTable: 'approvals', ascending: false })
      .order('uploaded_at', { referencedTable: 'design_reviews', ascending: false })
      .single()

    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = data as any
      const mapped: Campaign = {
        id: raw.id,
        brand_id: raw.brand_id,
        title: raw.title,
        type: raw.type,
        month: raw.month,
        status: raw.status,
        subject_line: raw.subject_line,
        preview_text: raw.preview_text,
        notes: raw.notes,
        brands: Array.isArray(raw.brands) ? raw.brands[0] ?? null : raw.brands,
        approvals: (raw.approvals ?? []).map((a: Record<string, unknown>) => ({
          id: a.id,
          action: a.action,
          comment: a.comment,
          actioned_at: a.actioned_at,
          profiles: Array.isArray(a.profiles) ? (a.profiles as { full_name: string }[])[0] ?? null : a.profiles,
        })),
        design_reviews: (raw.design_reviews ?? []).map((dr: Record<string, unknown>) => ({
          id: dr.id,
          image_url: dr.image_url,
          status: dr.status,
          stakeholder_comment: dr.stakeholder_comment,
          uploaded_at: dr.uploaded_at,
          reviewed_at: dr.reviewed_at,
          profiles_uploaded: Array.isArray(dr['profiles!uploaded_by'])
            ? (dr['profiles!uploaded_by'] as { full_name: string }[])[0] ?? null
            : (dr['profiles!uploaded_by'] as { full_name: string } | null),
          profiles_reviewed: Array.isArray(dr['profiles!reviewed_by'])
            ? (dr['profiles!reviewed_by'] as { full_name: string }[])[0] ?? null
            : (dr['profiles!reviewed_by'] as { full_name: string } | null),
        })),
      }
      setCampaign(mapped)
      setEditForm({
        brand_id: mapped.brand_id,
        title: mapped.title,
        type: mapped.type,
        month: toMonthInput(mapped.month),
        subject_line: mapped.subject_line ?? '',
        preview_text: mapped.preview_text ?? '',
        notes: mapped.notes ?? '',
      })
    }
    setLoading(false)
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    fetchCampaign()
  }, [fetchCampaign])

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateCampaign(campaignId, editForm)
        await fetchCampaign()
        setEditing(false)
        addToast('Campaign updated')
      } catch {
        addToast('Failed to update campaign', 'error')
      }
    })
  }

  const handleSubmitForApproval = () => {
    startTransition(async () => {
      try {
        await submitForApproval(campaignId)
        await fetchCampaign()
        addToast('Submitted for approval — stakeholders notified')
      } catch {
        addToast('Failed to submit', 'error')
      }
    })
  }

  const handleApprove = () => {
    startTransition(async () => {
      try {
        await approveCampaign(campaignId, approvalComment)
        await fetchCampaign()
        setApprovalComment('')
        addToast('Campaign approved')
      } catch {
        addToast('Failed to approve', 'error')
      }
    })
  }

  const handleDecline = () => {
    startTransition(async () => {
      try {
        await declineCampaign(campaignId, approvalComment)
        await fetchCampaign()
        setApprovalComment('')
        addToast('Campaign declined')
      } catch {
        addToast('Failed to decline', 'error')
      }
    })
  }

  const handleAdvance = () => {
    if (!campaign) return
    const next = STATUS_ADVANCE[campaign.status]
    if (!next) return
    startTransition(async () => {
      try {
        await advanceStatus(campaignId, next)
        await fetchCampaign()
        addToast(`Status advanced to ${STATUS_LABELS[next]}`)
      } catch {
        addToast('Failed to advance status', 'error')
      }
    })
  }

  const handleDesignUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDesign(true)
    try {
      const supabase = createClient()
      const path = `${campaignId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('design-previews')
        .upload(path, file, { upsert: false })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('design-previews')
        .getPublicUrl(uploadData.path)

      await createDesignReview(campaignId, publicUrl)
      await fetchCampaign()
      addToast('Design uploaded — stakeholders notified')
    } catch {
      addToast('Failed to upload design', 'error')
    } finally {
      setUploadingDesign(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDesignReview = (reviewId: string, action: 'approved' | 'declined') => {
    startTransition(async () => {
      try {
        await reviewDesign(reviewId, action, designComment)
        await fetchCampaign()
        setDesignComment('')
        addToast(`Design ${action}`)
      } catch {
        addToast('Failed to review design', 'error')
      }
    })
  }

  const latestApproval = campaign?.approvals?.[0] ?? null
  const canSubmit = role === 'marketing' && campaign && ['idea', 'in_production'].includes(campaign.status)
  const canApprove = role === 'stakeholder' && campaign?.status === 'proposed'
  const nextStatus = campaign ? STATUS_ADVANCE[campaign.status] : null
  const canAdvance = role === 'marketing' && !!nextStatus

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {campaign?.brands && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: campaign.brands.color }}
              />
            )}
            <h2 className="font-bold text-gray-900 text-lg truncate">
              {loading ? 'Loading…' : (campaign?.title ?? 'Campaign')}
            </h2>
            {campaign && (
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS_COLORS[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {STATUS_LABELS[campaign.status] ?? campaign.status}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 ml-4"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !campaign ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Campaign not found.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Campaign Fields */}
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Campaign Details
                </h3>
                {role === 'marketing' && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
                    <select
                      className={inputCls}
                      value={editForm.brand_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, brand_id: e.target.value }))}
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                    <input
                      className={inputCls}
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select
                        className={inputCls}
                        value={editForm.type}
                        onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                      >
                        <option value="evergreen">Evergreen</option>
                        <option value="promotional">Promotional</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
                      <input
                        type="month"
                        className={inputCls}
                        value={editForm.month}
                        onChange={(e) => setEditForm((f) => ({ ...f, month: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subject Line</label>
                    <input
                      className={inputCls}
                      value={editForm.subject_line}
                      onChange={(e) => setEditForm((f) => ({ ...f, subject_line: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Preview Text</label>
                    <input
                      className={inputCls}
                      value={editForm.preview_text}
                      onChange={(e) => setEditForm((f) => ({ ...f, preview_text: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={3}
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditing(false)}
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isPending}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                      style={{ backgroundColor: '#1B2B4B' }}
                    >
                      {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Brand</dt>
                      <dd className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                        {campaign.brands && (
                          <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{ backgroundColor: campaign.brands.color }}
                          />
                        )}
                        {campaign.brands?.name ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Month</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {formatMonth(campaign.month) || '—'}
                      </dd>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Type</dt>
                      <dd>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            campaign.type === 'evergreen'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {campaign.type}
                        </span>
                      </dd>
                    </div>
                  </div>
                  {campaign.subject_line && (
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Subject Line</dt>
                      <dd className="text-sm text-gray-900">{campaign.subject_line}</dd>
                    </div>
                  )}
                  {campaign.preview_text && (
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Preview Text</dt>
                      <dd className="text-sm text-gray-900">{campaign.preview_text}</dd>
                    </div>
                  )}
                  {campaign.notes && (
                    <div>
                      <dt className="text-xs text-gray-400 mb-0.5">Notes</dt>
                      <dd className="text-sm text-gray-900 whitespace-pre-wrap">{campaign.notes}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {/* Action Buttons */}
            {(canSubmit || canAdvance) && (
              <div className="px-6 py-4 border-b border-gray-100 flex gap-3 flex-wrap">
                {canSubmit && (
                  <button
                    onClick={handleSubmitForApproval}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#E8611A' }}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Submit for Approval
                  </button>
                )}
                {canAdvance && (
                  <button
                    onClick={handleAdvance}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#1B2B4B' }}
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Move to {STATUS_LABELS[nextStatus!]}
                  </button>
                )}
              </div>
            )}

            {/* Approval Section */}
            {campaign.status !== 'idea' && (
              <div className="px-6 py-5 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Approval
                </h3>

                {canApprove ? (
                  <div className="space-y-3">
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={2}
                      placeholder="Optional comment…"
                      value={approvalComment}
                      onChange={(e) => setApprovalComment(e.target.value)}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleApprove}
                        disabled={isPending}
                        className="flex items-center gap-2 flex-1 justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-60"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={isPending}
                        className="flex items-center gap-2 flex-1 justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Decline
                      </button>
                    </div>
                  </div>
                ) : latestApproval ? (
                  <div
                    className={`rounded-xl p-4 ${
                      latestApproval.action === 'approved'
                        ? 'bg-green-50 border border-green-100'
                        : 'bg-red-50 border border-red-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {latestApproval.action === 'approved' ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-semibold capitalize ${
                          latestApproval.action === 'approved' ? 'text-green-700' : 'text-red-600'
                        }`}
                      >
                        {latestApproval.action} by {latestApproval.profiles?.full_name ?? 'Stakeholder'}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {timeAgo(latestApproval.actioned_at)}
                      </span>
                    </div>
                    {latestApproval.comment && (
                      <p className="text-sm text-gray-600 mt-1 pl-6">{latestApproval.comment}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    Awaiting stakeholder review
                  </div>
                )}
              </div>
            )}

            {/* Design Review Section */}
            <div className="px-6 py-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Design Review
              </h3>

              {role === 'marketing' && (
                <div className="mb-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleDesignUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDesign}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-60 w-full justify-center"
                  >
                    {uploadingDesign ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploadingDesign ? 'Uploading…' : 'Upload Design (PNG/JPG)'}
                  </button>
                </div>
              )}

              {campaign.design_reviews.length === 0 ? (
                <p className="text-sm text-gray-400">No design uploaded yet.</p>
              ) : (
                <div className="space-y-5">
                  {campaign.design_reviews.map((dr, idx) => (
                    <div key={dr.id} className="rounded-xl border border-gray-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dr.image_url}
                        alt={`Design ${idx + 1}`}
                        className="w-full object-contain max-h-64 bg-gray-50"
                      />
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            Uploaded {timeAgo(dr.uploaded_at)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              dr.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : dr.status === 'declined'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {dr.status}
                          </span>
                        </div>

                        {dr.stakeholder_comment && (
                          <p className="text-sm text-gray-600 italic">
                            &ldquo;{dr.stakeholder_comment}&rdquo;
                          </p>
                        )}

                        {role === 'stakeholder' && dr.status === 'pending' && (
                          <div className="space-y-2">
                            <textarea
                              className={`${inputCls} resize-none`}
                              rows={2}
                              placeholder="Optional comment…"
                              value={designComment}
                              onChange={(e) => setDesignComment(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDesignReview(dr.id, 'approved')}
                                disabled={isPending}
                                className="flex items-center gap-1.5 flex-1 justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 transition-colors"
                              >
                                {isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                Approve Design
                              </button>
                              <button
                                onClick={() => handleDesignReview(dr.id, 'declined')}
                                disabled={isPending}
                                className="flex items-center gap-1.5 flex-1 justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
                              >
                                {isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <XCircle className="w-3 h-3" />
                                )}
                                Decline Design
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
