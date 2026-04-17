import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  // Only marketing users can access settings
  if (profile?.role !== 'marketing') redirect('/dashboard')

  const [{ data: brands }, { data: users }] = await Promise.all([
    supabase.from('brands').select('*').order('name'),
    supabase.from('profiles').select('id, full_name, role, email, created_at').order('full_name'),
  ])

  return <SettingsClient brands={brands ?? []} users={users ?? []} />
}
