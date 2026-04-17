import { createClient } from '@/lib/supabase/server'
import PerformanceClient from './PerformanceClient'

export default async function PerformancePage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: brands },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('brands').select('id, name, color').eq('active', true).order('name'),
  ])

  let role = 'stakeholder'
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    role = profile?.role ?? 'stakeholder'
  }

  return <PerformanceClient role={role} brands={brands ?? []} />
}
