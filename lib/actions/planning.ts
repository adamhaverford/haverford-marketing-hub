'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getAuthedProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile) throw new Error('Profile not found')
  return { supabase, profile }
}

export async function createCampaign(data: {
  brand_id: string
  title: string
  type: string
  month: string
  subject_line: string
  preview_text: string
  notes: string
}) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const { error } = await supabase.from('campaigns').insert({
    brand_id: data.brand_id,
    title: data.title,
    type: data.type,
    month: data.month ? data.month + '-01' : null,
    subject_line: data.subject_line || null,
    preview_text: data.preview_text || null,
    notes: data.notes || null,
    status: 'idea',
    created_by: profile.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/planning')
}

export async function updateCampaign(
  campaignId: string,
  data: {
    title?: string
    type?: string
    month?: string
    subject_line?: string
    preview_text?: string
    notes?: string
  },
) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const updates: Record<string, string | null> = {}
  if (data.title !== undefined) updates.title = data.title
  if (data.type !== undefined) updates.type = data.type
  if (data.month !== undefined) updates.month = data.month ? data.month + '-01' : null
  if (data.subject_line !== undefined) updates.subject_line = data.subject_line || null
  if (data.preview_text !== undefined) updates.preview_text = data.preview_text || null
  if (data.notes !== undefined) updates.notes = data.notes || null

  const { error } = await supabase.from('campaigns').update(updates).eq('id', campaignId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning')
}

export async function submitForApproval(campaignId: string) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'proposed' })
    .eq('id', campaignId)
  if (error) throw new Error(error.message)

  const { data: stakeholders } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'stakeholder')

  if (stakeholders && stakeholders.length > 0) {
    await supabase.from('notifications').insert(
      stakeholders.map((s) => ({
        user_id: s.id,
        type: 'proposal_submitted',
        campaign_id: campaignId,
      })),
    )
  }

  revalidatePath('/planning')
  revalidatePath('/', 'layout')
}

export async function advanceStatus(campaignId: string, newStatus: string) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('campaigns')
    .update({ status: newStatus })
    .eq('id', campaignId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning')
}

export async function approveCampaign(campaignId: string, comment: string) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'stakeholder') throw new Error('Unauthorized')

  await supabase.from('approvals').insert({
    campaign_id: campaignId,
    actioned_by: profile.id,
    action: 'approved',
    comment: comment || null,
  })
  await supabase.from('campaigns').update({ status: 'approved' }).eq('id', campaignId)
  revalidatePath('/planning')
}

export async function declineCampaign(campaignId: string, comment: string) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'stakeholder') throw new Error('Unauthorized')

  await supabase.from('approvals').insert({
    campaign_id: campaignId,
    actioned_by: profile.id,
    action: 'declined',
    comment: comment || null,
  })
  await supabase.from('campaigns').update({ status: 'declined' }).eq('id', campaignId)
  revalidatePath('/planning')
}

export async function createDesignReview(campaignId: string, imageUrl: string) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const { error } = await supabase.from('design_reviews').insert({
    campaign_id: campaignId,
    image_url: imageUrl,
    uploaded_by: profile.id,
  })
  if (error) throw new Error(error.message)

  const { data: stakeholders } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'stakeholder')

  if (stakeholders && stakeholders.length > 0) {
    await supabase.from('notifications').insert(
      stakeholders.map((s) => ({
        user_id: s.id,
        type: 'design_uploaded',
        campaign_id: campaignId,
      })),
    )
  }

  revalidatePath('/planning')
  revalidatePath('/', 'layout')
}

export async function reviewDesign(
  reviewId: string,
  action: 'approved' | 'declined',
  comment: string,
) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'stakeholder') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('design_reviews')
    .update({
      status: action,
      stakeholder_comment: comment || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning')
}

export async function markNotificationRead(notificationId: string) {
  const { supabase } = await getAuthedProfile()
  await supabase.from('notifications').update({ read: true }).eq('id', notificationId)
  revalidatePath('/', 'layout')
}

export async function getNotifications() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile || profile.role !== 'stakeholder') return []

  const { data } = await supabase
    .from('notifications')
    .select('id, type, read, created_at, campaign_id, campaigns(id, title, brands(name, color))')
    .eq('user_id', profile.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(20)

  return data ?? []
}

// ----------------------------------------------------------------
// New planning topic actions
// ----------------------------------------------------------------

export async function addTopic(data: {
  brand_id: string
  month: string
  type: 'evergreen' | 'promotional'
  title: string
  description: string | null
}) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  const { error } = await supabase.from('planning_topics').insert({
    brand_id: data.brand_id,
    month: data.month,
    type: data.type,
    title: data.title,
    description: data.description || null,
    created_by: profile.id,
    status: 'proposed',
  })
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function reorderTopics(topicIds: string[]) {
  const { supabase } = await getAuthedProfile()
  await Promise.all(
    topicIds.map((id, index) =>
      supabase.from('planning_topics').update({ sort_order: index }).eq('id', id)
    )
  )
  revalidatePath('/planning', 'layout')
}

export async function setTopicStatus(
  topicId: string,
  status: 'proposed' | 'approved' | 'declined',
  comment?: string,
) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'stakeholder') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('planning_topics')
    .update({
      status,
      actioned_by: status === 'proposed' ? null : profile.id,
      actioned_at: status === 'proposed' ? null : new Date().toISOString(),
      action_comment: status === 'declined' ? (comment ?? null) : null,
    })
    .eq('id', topicId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function updateTopic(topicId: string, title: string, description: string | null) {
  const { supabase, profile } = await getAuthedProfile()

  const updates: Record<string, unknown> = { title: title.trim(), description: description?.trim() || null }

  // Stakeholder edits reset status to proposed so the topic needs re-review
  if (profile.role === 'stakeholder') {
    updates.status = 'proposed'
    updates.actioned_by = null
    updates.actioned_at = null
    updates.action_comment = null
  }

  const { error } = await supabase.from('planning_topics').update(updates).eq('id', topicId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function addTopicComment(topicId: string, comment: string) {
  const { supabase, profile } = await getAuthedProfile()

  const { error } = await supabase.from('planning_topic_comments').insert({
    topic_id: topicId,
    user_id: profile.id,
    comment: comment.trim(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

// ----------------------------------------------------------------
// New planning design actions
// ----------------------------------------------------------------

export async function uploadDesign(data: {
  brand_id: string
  month: string
  type: 'evergreen' | 'promotional'
  file_url: string
}) {
  const { profile } = await getAuthedProfile()
  if (profile.role !== 'marketing') throw new Error('Unauthorized')

  // Use admin client to bypass RLS for the design table writes
  const admin = createAdminClient()

  await admin
    .from('planning_designs')
    .update({ is_current: false })
    .eq('brand_id', data.brand_id)
    .eq('month', data.month)
    .eq('type', data.type)
    .eq('is_current', true)

  const { error } = await admin.from('planning_designs').insert({
    brand_id: data.brand_id,
    month: data.month,
    type: data.type,
    file_url: data.file_url,
    uploaded_by: profile.id,
    status: 'pending',
    is_current: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function setDesignStatus(
  designId: string,
  status: 'pending' | 'approved' | 'declined',
) {
  const { supabase, profile } = await getAuthedProfile()
  if (profile.role !== 'stakeholder') throw new Error('Unauthorized')

  const { error } = await supabase
    .from('planning_designs')
    .update({
      status,
      actioned_by: status === 'pending' ? null : profile.id,
      actioned_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', designId)
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function addDesignComment(designId: string, comment: string) {
  const { supabase, profile } = await getAuthedProfile()

  const { error } = await supabase.from('planning_design_comments').insert({
    design_id: designId,
    user_id: profile.id,
    comment: comment.trim(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}

export async function recordNotificationClick(entityId: string, entityType: 'topic' | 'design') {
  const { supabase, profile } = await getAuthedProfile()

  const { error } = await supabase
    .from('notification_clicks')
    .upsert(
      { user_id: profile.id, entity_id: entityId, entity_type: entityType, clicked_at: new Date().toISOString() },
      { onConflict: 'user_id,entity_id,entity_type' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function dismissNotification(dismissId: string) {
  const { supabase, profile } = await getAuthedProfile()

  const { error } = await supabase
    .from('notification_clicks')
    .upsert(
      { user_id: profile.id, entity_id: dismissId, entity_type: 'dismissal', clicked_at: new Date().toISOString() },
      { onConflict: 'user_id,entity_id,entity_type' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}
