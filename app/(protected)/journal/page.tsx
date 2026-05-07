import { createClient } from '@/lib/supabase/server'
import JournalClient from './JournalClient'

export default async function JournalPage() {
  const supabase = createClient()

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color, klaviyo_account')
    .eq('active', true)
    .order('name')

  return <JournalClient brands={brands ?? []} />
}
