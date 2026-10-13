import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanningIndexClient from '@/components/planning/PlanningIndexClient'

export default async function PlanningPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color, description, klaviyo_account, schedule_only')
    .eq('active', true)
    .order('name')

  if (!brands || brands.length === 0) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Planning</h2>
        <p className="text-gray-400 text-sm">No active brands found.</p>
      </div>
    )
  }

  return <PlanningIndexClient brands={brands} />
}
