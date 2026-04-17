import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PlanningClient from '@/components/planning/PlanningClient'

interface Campaign {
  id: string
  brand_id: string
  title: string
  type: string
  month: string | null
  status: string
  brands: { name: string; color: string } | null
}

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: { campaign?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  const role = profile?.role ?? 'marketing'

  const [{ data: brands }, { data: campaigns }] = await Promise.all([
    supabase.from('brands').select('id, name, color').eq('active', true).order('name'),
    supabase
      .from('campaigns')
      .select('id, brand_id, title, type, month, status, brands(name, color)')
      .order('created_at', { ascending: false }),
  ])

  return (
    <PlanningClient
      campaigns={(campaigns as unknown as Campaign[]) ?? []}
      brands={brands ?? []}
      role={role}
      initialCampaignId={searchParams.campaign}
    />
  )
}
