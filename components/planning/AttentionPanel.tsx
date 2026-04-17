import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { getUpcomingMonths, formatMonthLabel } from '@/lib/utils'

interface AttentionItem {
  href: string
  message: string
  brandName: string
  brandColor: string
  type: 'warning' | 'info' | 'urgent'
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
  const upcomingMonths = getUpcomingMonths(6)

  if (profile.role === 'stakeholder') {
    // Topics awaiting approval
    const { data: pendingTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .eq('status', 'proposed')

    const topicGroups = new Map<string, { brandId: string; month: string }>()
    for (const t of (pendingTopics ?? [])) {
      const key = `${t.brand_id}-${t.month}`
      if (!topicGroups.has(key)) topicGroups.set(key, { brandId: t.brand_id, month: t.month })
    }
    Array.from(topicGroups.values()).forEach(({ brandId, month }) => {
      const brand = brandMap[brandId]
      if (!brand) return
      const count = (pendingTopics ?? []).filter(t => t.brand_id === brandId && t.month === month).length
      items.push({
        href: `/planning/${brandId}/${month}`,
        message: `${count} topic${count !== 1 ? 's' : ''} waiting for your approval`,
        brandName: brand.name,
        brandColor: brand.color,
        type: 'urgent',
      })
    })
    }

    // Designs awaiting review
    const { data: pendingDesigns } = await supabase
      .from('planning_designs')
      .select('id, brand_id, month')
      .eq('status', 'pending')
      .eq('is_current', true)

    for (const d of (pendingDesigns ?? [])) {
      const brand = brandMap[d.brand_id]
      if (!brand) continue
      items.push({
        href: `/planning/${d.brand_id}/${d.month}`,
        message: 'Design waiting for your review',
        brandName: brand.name,
        brandColor: brand.color,
        type: 'urgent',
      })
    }

    // Months with no topics (informational)
    const { data: existingTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .in('month', upcomingMonths)

    const coveredKeys = new Set((existingTopics ?? []).map(t => `${t.brand_id}-${t.month}`))
    for (const brand of brands) {
      for (const month of upcomingMonths) {
        if (!coveredKeys.has(`${brand.id}-${month}`)) {
          items.push({
            href: `/planning/${brand.id}/${month}`,
            message: `No topics proposed for ${formatMonthLabel(month)}`,
            brandName: brand.name,
            brandColor: brand.color,
            type: 'info',
          })
        }
      }
    }
  } else {
    // Marketing role

    // Months with no topics (next 6 months)
    const { data: existingTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .in('month', upcomingMonths)

    const coveredKeys = new Set((existingTopics ?? []).map(t => `${t.brand_id}-${t.month}`))
    for (const brand of brands) {
      for (const month of upcomingMonths) {
        if (!coveredKeys.has(`${brand.id}-${month}`)) {
          items.push({
            href: `/planning/${brand.id}/${month}`,
            message: `No topics yet for ${formatMonthLabel(month)}`,
            brandName: brand.name,
            brandColor: brand.color,
            type: 'warning',
          })
        }
      }
    }

    // Declined topics needing revision
    const { data: declinedTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month')
      .eq('status', 'declined')

    const declinedGroups = new Map<string, { brandId: string; month: string }>()
    for (const t of (declinedTopics ?? [])) {
      const key = `${t.brand_id}-${t.month}`
      if (!declinedGroups.has(key)) declinedGroups.set(key, { brandId: t.brand_id, month: t.month })
    }
    Array.from(declinedGroups.values()).forEach(({ brandId, month }) => {
      const brand = brandMap[brandId]
      if (!brand) return
      const count = (declinedTopics ?? []).filter(t => t.brand_id === brandId && t.month === month).length
      items.push({
        href: `/planning/${brandId}/${month}`,
        message: `${count} declined topic${count !== 1 ? 's' : ''} need revision`,
        brandName: brand.name,
        brandColor: brand.color,
        type: 'warning',
      })
    })
    }

    // Months with approved topics but no design uploaded
    const { data: approvedTopics } = await supabase
      .from('planning_topics')
      .select('brand_id, month, type')
      .eq('status', 'approved')

    const { data: uploadedDesigns } = await supabase
      .from('planning_designs')
      .select('brand_id, month, type')
      .eq('is_current', true)

    const designKeys = new Set((uploadedDesigns ?? []).map(d => `${d.brand_id}-${d.month}-${d.type}`))
    const checkedKeys = new Set<string>()
    for (const t of (approvedTopics ?? [])) {
      const key = `${t.brand_id}-${t.month}-${t.type}`
      if (!designKeys.has(key) && !checkedKeys.has(key)) {
        checkedKeys.add(key)
        const brand = brandMap[t.brand_id]
        if (!brand) continue
        items.push({
          href: `/planning/${t.brand_id}/${t.month}`,
          message: `${t.type === 'evergreen' ? 'Evergreen' : 'Promotional'} design needs uploading`,
          brandName: brand.name,
          brandColor: brand.color,
          type: 'warning',
        })
      }
    }
  }

  if (items.length === 0) return null

  const typeStyle: Record<string, string> = {
    urgent: 'border-l-orange-500 bg-orange-50',
    warning: 'border-l-yellow-500 bg-yellow-50',
    info: 'border-l-blue-400 bg-blue-50',
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
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 transition-all hover:shadow-sm hover:-translate-x-0.5 ${typeStyle[item.type]}`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.brandColor }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{item.message}</p>
              <p className="text-xs text-gray-500">{item.brandName}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  )
}
