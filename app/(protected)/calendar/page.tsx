import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CalendarClient from './CalendarClient'

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color')
    .eq('active', true)
    .order('name')

  return <CalendarClient brands={brands ?? []} />
}
