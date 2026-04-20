import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, ArrowRight, CheckCircle } from 'lucide-react'
import CommentNotificationItem from './CommentNotificationItem'

interface AttentionItem {
  href: string
  message: string
  brandName: string
  brandColor: string
  type: 'urgent' | 'warning' | 'comment'
  entityId?: string
  entityType?: 'topic' | 'design'
}

export default async function AttentionPanel() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single()
  if (!profile) return null

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color')
    .eq('active', true)
    .order('name')
  if (!brands || brands.length === 0) return null

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]))
  const items: AttentionItem[] = []
  const seenKeys = new Set<string>()

  function addItem(item: AttentionItem, dedupeKey: string) {
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey)
      items.push(item)
    }
  }

  // ── Stakeholder: pending topic approvals ──────────────────────
  if (profile.role === 'stakeholder') {
    const { data: pendingTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .eq('status', 'proposed')

    const topicGroupMap: Record<string, { brandId: string; month: string }> = {}
    for (const t of (pendingTopics ?? [])) {
      const key = `${t.brand_id}-${t.month}`
      if (!topicGroupMap[key]) topicGroupMap[key] = { brandId: t.brand_id, month: t.month }
    }
    for (const { brandId, month } of Object.values(topicGroupMap)) {
      const brand = brandMap[brandId]
      if (!brand) continue
      const count = (pendingTopics ?? []).filter(t => t.brand_id === brandId && t.month === month).length
      addItem({
        href: `/planning/${brandId}/${month}`,
        message: `${count} topic${count !== 1 ? 's' : ''} waiting for your approval`,
        brandName: brand.name,
        brandColor: brand.color,
        type: 'urgent',
      }, `approval-${brandId}-${month}`)
    }

    const { data: pendingDesigns } = await supabase
      .from('planning_designs')
      .select('brand_id, month')
      .eq('status', 'pending')
      .eq('is_current', true)

    for (const d of (pendingDesigns ?? [])) {
      const brand = brandMap[d.brand_id]
      if (!brand) continue
      addItem({
        href: `/planning/${d.brand_id}/${d.month}`,
        message: 'Design waiting for your review',
        brandName: brand.name,
        brandColor: brand.color,
        type: 'urgent',
      }, `design-review-${d.brand_id}-${d.month}`)
    }
  }

  // ── Marketing: declined topics needing revision ───────────────
  if (profile.role === 'marketing') {
    const { data: declinedTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .eq('status', 'declined')

    const declinedGroupMap: Record<string, { brandId: string; month: string }> = {}
    for (const t of (declinedTopics ?? [])) {
      const key = `${t.brand_id}-${t.month}`
      if (!declinedGroupMap[key]) declinedGroupMap[key] = { brandId: t.brand_id, month: t.month }
    }
    for (const { brandId, month } of Object.values(declinedGroupMap)) {
      const brand = brandMap[brandId]
      if (!brand) continue
      const count = (declinedTopics ?? []).filter(t => t.brand_id === brandId && t.month === month).length
      addItem({
        href: `/planning/${brandId}/${month}`,
        message: `${count} declined topic${count !== 1 ? 's' : ''} need revision`,
        brandName: brand.name,
        brandColor: brand.color,
        type: 'warning',
      }, `declined-${brandId}-${month}`)
    }

    const { data: declinedDesigns } = await supabase
      .from('planning_designs')
      .select('brand_id, month')
      .eq('status', 'declined')
      .eq('is_current', true)

    const declinedDesignGroupMap: Record<string, { brandId: string; month: string }> = {}
    for (const d of (declinedDesigns ?? [])) {
      const key = `${d.brand_id}-${d.month}`
      if (!declinedDesignGroupMap[key]) declinedDesignGroupMap[key] = { brandId: d.brand_id, month: d.month }
    }
    for (const { brandId, month } of Object.values(declinedDesignGroupMap)) {
      const brand = brandMap[brandId]
      if (!brand) continue
      const count = (declinedDesigns ?? []).filter(d => d.brand_id === brandId && d.month === month).length
      addItem({
        href: `/planning/${brandId}/${month}`,
        message: `${count} declined design${count !== 1 ? 's' : ''} need revision`,
        brandName: brand.name,
        brandColor: brand.color,
        type: 'warning',
      }, `declined-design-${brandId}-${month}`)
    }
  }

  // ── Both roles: topics or designs with new comments (last 7 days) ──
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: recentTopicComments },
    { data: recentDesignComments },
    { data: clicks },
  ] = await Promise.all([
    supabase
      .from('planning_topic_comments')
      .select('user_id, created_at, planning_topics(id, brand_id, month)')
      .gt('created_at', cutoff)
      .neq('user_id', profile.id),
    supabase
      .from('planning_design_comments')
      .select('user_id, created_at, planning_designs(id, brand_id, month)')
      .gt('created_at', cutoff)
      .neq('user_id', profile.id),
    supabase
      .from('notification_clicks')
      .select('entity_id, entity_type, clicked_at')
      .eq('user_id', profile.id),
  ])

  // Build click-record lookup: `${entityType}-${entityId}` → clicked_at
  const clickMap = new Map<string, string>()
  for (const click of (clicks ?? [])) {
    clickMap.set(`${click.entity_type}-${click.entity_id}`, click.clicked_at)
  }

  // Group topic comments by topic id, keeping the newest created_at per topic
  const topicCommentMap = new Map<string, { topic: { id: string; brand_id: string; month: string }; newestAt: string }>()
  for (const c of (recentTopicComments ?? [])) {
    const topic = Array.isArray(c.planning_topics) ? c.planning_topics[0] : c.planning_topics
    if (!topic) continue
    const existing = topicCommentMap.get(topic.id)
    if (!existing || c.created_at > existing.newestAt) {
      topicCommentMap.set(topic.id, { topic, newestAt: c.created_at })
    }
  }
  for (const [topicId, { topic, newestAt }] of topicCommentMap) {
    const clickedAt = clickMap.get(`topic-${topicId}`)
    if (clickedAt && newestAt <= clickedAt) continue
    const brand = brandMap[topic.brand_id]
    if (!brand) continue
    addItem({
      href: `/planning/${topic.brand_id}/${topic.month}?highlight=topic-${topicId}`,
      message: 'New comment on a topic',
      brandName: brand.name,
      brandColor: brand.color,
      type: 'comment',
      entityId: topicId,
      entityType: 'topic',
    }, `topic-comment-${topicId}`)
  }

  // Group design comments by design id, keeping the newest created_at per design
  const designCommentMap = new Map<string, { design: { id: string; brand_id: string; month: string }; newestAt: string }>()
  for (const c of (recentDesignComments ?? [])) {
    const design = Array.isArray(c.planning_designs) ? c.planning_designs[0] : c.planning_designs
    if (!design) continue
    const existing = designCommentMap.get(design.id)
    if (!existing || c.created_at > existing.newestAt) {
      designCommentMap.set(design.id, { design, newestAt: c.created_at })
    }
  }
  for (const [designId, { design, newestAt }] of designCommentMap) {
    const clickedAt = clickMap.get(`design-${designId}`)
    if (clickedAt && newestAt <= clickedAt) continue
    const brand = brandMap[design.brand_id]
    if (!brand) continue
    addItem({
      href: `/planning/${design.brand_id}/${design.month}?highlight=design-${designId}`,
      message: 'New comment on a design',
      brandName: brand.name,
      brandColor: brand.color,
      type: 'comment',
      entityId: designId,
      entityType: 'design',
    }, `design-comment-${designId}`)
  }

  // ── Empty state ───────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Needs Your Attention
          </h3>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">All up to date ✓</p>
        </div>
      </section>
    )
  }

  const typeStyle: Record<string, string> = {
    urgent:  'border-l-orange-500 bg-orange-50',
    warning: 'border-l-yellow-500 bg-yellow-50',
    comment: 'border-l-blue-400 bg-blue-50',
  }

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Needs Your Attention
        </h3>
        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white bg-orange-500">
          {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const rowClass = `flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 transition-all hover:shadow-sm hover:-translate-x-0.5 ${typeStyle[item.type]}`
          if (item.entityId && item.entityType) {
            return (
              <CommentNotificationItem
                key={i}
                href={item.href}
                message={item.message}
                brandName={item.brandName}
                brandColor={item.brandColor}
                className={rowClass}
                entityId={item.entityId}
                entityType={item.entityType}
              />
            )
          }
          return (
            <Link key={i} href={item.href} className={rowClass}>
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.brandColor }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{item.message}</p>
                <p className="text-xs text-gray-500">{item.brandName}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
