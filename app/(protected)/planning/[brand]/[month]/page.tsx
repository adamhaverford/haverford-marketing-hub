import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MonthSection from '@/components/planning/MonthSection'
import { formatMonthLabel } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: { brand: string; month: string }
}

export default async function MonthDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  const role = (profile?.role ?? 'marketing') as 'marketing' | 'stakeholder'

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color, description')
    .eq('id', params.brand)
    .eq('active', true)
    .single()

  if (!brand) notFound()

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(params.month)) notFound()

  // Fetch all topics for this brand+month with their comments
  const { data: topicsRaw } = await supabase
    .from('planning_topics')
    .select(`
      id,
      title,
      description,
      type,
      status,
      created_at,
      action_comment,
      actioned_at,
      created_by,
      actioned_by,
      planning_topic_comments (
        id,
        comment,
        created_at,
        user_id,
        profiles:user_id ( full_name )
      )
    `)
    .eq('brand_id', params.brand)
    .eq('month', params.month)
    .order('created_at', { ascending: true })

  // Fetch all designs for this brand+month with their comments
  const { data: designsRaw } = await supabase
    .from('planning_designs')
    .select(`
      id,
      type,
      file_url,
      uploaded_at,
      status,
      is_current,
      actioned_at,
      uploaded_by,
      actioned_by,
      planning_design_comments (
        id,
        comment,
        created_at,
        user_id,
        profiles:user_id ( full_name )
      )
    `)
    .eq('brand_id', params.brand)
    .eq('month', params.month)
    .order('uploaded_at', { ascending: false })

  // Fetch profile names for created_by and actioned_by
  const profileIds = new Set<string>()
  for (const t of (topicsRaw ?? [])) {
    if (t.created_by) profileIds.add(t.created_by)
    if (t.actioned_by) profileIds.add(t.actioned_by)
  }
  for (const d of (designsRaw ?? [])) {
    if (d.uploaded_by) profileIds.add(d.uploaded_by)
    if (d.actioned_by) profileIds.add(d.actioned_by)
  }

  const profileMap = new Map<string, string | null>()
  if (profileIds.size > 0) {
    const { data: profilesList } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(profileIds))
    for (const p of (profilesList ?? [])) {
      profileMap.set(p.id, p.full_name)
    }
  }

  function buildTopics(type: 'evergreen' | 'promotional') {
    return (topicsRaw ?? [])
      .filter(t => t.type === type)
      .map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as 'proposed' | 'approved' | 'declined',
        created_at: t.created_at,
        action_comment: t.action_comment,
        actioned_at: t.actioned_at,
        profiles: t.created_by ? { full_name: profileMap.get(t.created_by) ?? null } : null,
        actioned_by_profile: t.actioned_by ? { full_name: profileMap.get(t.actioned_by) ?? null } : null,
        comments: ((t.planning_topic_comments as unknown as {
          id: string; comment: string; created_at: string; user_id: string;
          profiles: { full_name: string | null } | null
        }[]) ?? []).map(c => ({
          id: c.id,
          comment: c.comment,
          created_at: c.created_at,
          profiles: c.profiles,
        })),
      }))
  }

  function buildDesigns(type: 'evergreen' | 'promotional') {
    return (designsRaw ?? [])
      .filter(d => d.type === type)
      .map(d => ({
        id: d.id,
        file_url: d.file_url,
        uploaded_at: d.uploaded_at,
        status: d.status as 'pending' | 'approved' | 'declined',
        is_current: d.is_current,
        actioned_at: d.actioned_at,
        uploaded_by_profile: d.uploaded_by ? { full_name: profileMap.get(d.uploaded_by) ?? null } : null,
        actioned_by_profile: d.actioned_by ? { full_name: profileMap.get(d.actioned_by) ?? null } : null,
        comments: ((d.planning_design_comments as unknown as {
          id: string; comment: string; created_at: string; user_id: string;
          profiles: { full_name: string | null } | null
        }[]) ?? []).map(c => ({
          id: c.id,
          comment: c.comment,
          created_at: c.created_at,
          profiles: c.profiles,
        })),
      }))
  }

  const monthLabel = formatMonthLabel(params.month)

  return (
    <div className="p-8 max-w-4xl">
      {/* Back + heading */}
      <div className="mb-8">
        <Link
          href={`/planning/${brand.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {brand.name} — all months
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-3 h-10 rounded-full" style={{ backgroundColor: brand.color }} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {monthLabel}
            </h2>
            <p className="text-gray-500 text-sm">{brand.name}</p>
          </div>
        </div>
      </div>

      {/* Two sections stacked */}
      <div className="space-y-6">
        <MonthSection
          brandId={brand.id}
          month={params.month}
          type="evergreen"
          topics={buildTopics('evergreen')}
          designs={buildDesigns('evergreen')}
          role={role}
        />
        <MonthSection
          brandId={brand.id}
          month={params.month}
          type="promotional"
          topics={buildTopics('promotional')}
          designs={buildDesigns('promotional')}
          role={role}
        />
      </div>
    </div>
  )
}
