'use server'

import { createClient } from '@/lib/supabase/server'
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
