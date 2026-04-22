import { createClient } from '@/lib/supabase/server'
import PerformanceClient from './PerformanceClient'

export default async function PerformancePage() {
  const supabase = createClient()

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color, klaviyo_account')
    .eq('active', true)
    .order('name')

  return <PerformanceClient brands={brands ?? []} />
}
