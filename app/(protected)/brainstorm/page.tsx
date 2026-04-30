import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrainstormClient from '@/components/brainstorm/BrainstormClient'

export default async function BrainstormPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: brands }, { data: ideasRaw, error: ideasError }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('brands').select('id, name, color').eq('active', true).order('name'),
    supabase
      .from('brainstorm_ideas')
      .select(`
        id, text, brand_id, topic_type, status,
        proceeded_to_month, proceeded_to_topic_id,
        created_by, created_at,
        brand:brand_id(name, color)
      `)
      .order('created_at', { ascending: false }),
  ])

  if (ideasError) console.error('[brainstorm] ideas query error:', ideasError)

  const ideas = (ideasRaw ?? []).map((i: {
    id: string
    text: string
    brand_id: string | null
    topic_type: 'evergreen' | 'promotional' | null
    status: 'new' | 'proceeded' | 'declined'
    proceeded_to_month: string | null
    proceeded_to_topic_id: string | null
    created_by: string | null
    created_at: string
    brand: { name: string; color: string }[] | null
  }) => ({
    id: i.id,
    text: i.text,
    brand_id: i.brand_id,
    topic_type: i.topic_type,
    status: i.status,
    proceeded_to_month: i.proceeded_to_month,
    proceeded_to_topic_id: i.proceeded_to_topic_id,
    created_by: i.created_by,
    created_at: i.created_at,
    brand_name: i.brand?.[0]?.name ?? null,
    brand_color: i.brand?.[0]?.color ?? null,
    creator_name: null,
  }))

  console.log('[brainstorm] ideas fetched:', ideas.length)

  return (
    <BrainstormClient
      initialIdeas={ideas}
      brands={brands ?? []}
      currentUserId={user.id}
      currentUserName={profile?.full_name ?? ''}
    />
  )
}
