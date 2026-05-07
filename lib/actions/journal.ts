'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type JournalEntry = {
  id: string
  brand_id: string
  flow_id: string
  flow_name: string
  changed_at: string
  changed_by: string | null
  category: string
  description: string
  before_value: string | null
  after_value: string | null
  notes: string | null
  outcome: 'improved' | 'worse' | 'neutral' | null
  created_at: string
  logged_by_name: string | null
}

export async function getJournalEntries(brandId: string, flowId?: string): Promise<JournalEntry[]> {
  const supabase = createAdminClient()
  let query = supabase
    .from('flow_journal_entries')
    .select('*')
    .eq('brand_id', brandId)
    .order('changed_at', { ascending: false })
  if (flowId) query = query.eq('flow_id', flowId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data as JournalEntry[]
}

export async function addJournalEntry(entry: {
  brand_id: string
  flow_id: string
  flow_name: string
  changed_at: string
  category: string
  description: string
  before_value?: string | null
  after_value?: string | null
  notes?: string | null
}): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  let loggedByName: string | null = null
  if (user?.id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .single()
    loggedByName = profile?.full_name ?? null
  }

  const { error } = await admin.from('flow_journal_entries').insert({
    ...entry,
    changed_by: user?.id ?? null,
    logged_by_name: loggedByName,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/journal')
  revalidatePath('/performance')
}

export async function updateJournalOutcome(
  entryId: string,
  outcome: 'improved' | 'worse' | 'neutral' | null
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('flow_journal_entries')
    .update({ outcome })
    .eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath('/journal')
  revalidatePath('/performance')
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('flow_journal_entries')
    .delete()
    .eq('id', entryId)
  if (error) throw new Error(error.message)
  revalidatePath('/journal')
  revalidatePath('/performance')
}
