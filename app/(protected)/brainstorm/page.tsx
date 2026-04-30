import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BrainstormClient from '@/components/brainstorm/BrainstormClient'

export default async function BrainstormPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: brands }, { data: ideasRaw }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    supabase.from('brands').select('id, name, color').eq('active', true).order('name'),
    supabase
      .from('brainstorm_ideas')
      .select(`
        id, text, brand_id, topic_type, status,
        proceeded_to_month, proceeded_to_topic_id,
        created_by, created_at,
        brand:brand_id(name, color),
        creator:created_by(full_name)
      `)
      .order('created_at', { ascending: false }),
  ])

  const ideas = (ideasRaw ?? []).map((i: any) => ({
    id: i.id as string,
    text: i.text as string,
    brand_id: i.brand_id as string | null,
    topic_type: i.topic_type as 'evergreen' | 'promotional' | null,
    status: i.status as 'new' | 'proceeded' | 'declined',
    proceeded_to_month: i.proceeded_to_month as string | null,
    proceeded_to_topic_id: i.proceeded_to_topic_id as string | null,
    created_by: i.created_by as string | null,
    created_at: i.created_at as string,
    brand_name: (i.brand as any)?.name ?? null,
    brand_color: (i.brand as any)?.color ?? null,
    creator_name: (i.creator as any)?.full_name ?? null,
  }))

  return (
    <BrainstormClient
      initialIdeas={ideas}
      brands={brands ?? []}
      currentUserId={user.id}
      currentUserName={profile?.full_name ?? ''}
    />
  )
}
