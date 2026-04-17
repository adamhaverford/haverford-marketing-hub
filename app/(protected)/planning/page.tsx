import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BrandCard from '@/components/planning/BrandCard'
import { getUpcomingMonths } from '@/lib/utils'

export default async function PlanningPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color, description')
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

  const upcomingMonths = getUpcomingMonths(12)

  // Fetch topic counts per brand to compute "months needing attention" and pending approvals
  const [{ data: allTopics }, { data: allDesigns }] = await Promise.all([
    supabase
      .from('planning_topics')
      .select('brand_id, month, status')
      .in('month', upcomingMonths),
    supabase
      .from('planning_designs')
      .select('brand_id, month, status')
      .in('month', upcomingMonths)
      .eq('is_current', true),
  ])

  const brandStats = brands.map(brand => {
    const brandTopics = (allTopics ?? []).filter(t => t.brand_id === brand.id)
    const brandDesigns = (allDesigns ?? []).filter(d => d.brand_id === brand.id)

    // Months needing attention = months with no topics OR declined topics OR pending designs
    const monthsWithIssues = new Set<string>()
    for (const month of upcomingMonths) {
      const monthTopics = brandTopics.filter(t => t.month === month)
      const monthDesigns = brandDesigns.filter(d => d.month === month)
      if (
        monthTopics.length === 0 ||
        monthTopics.some(t => t.status === 'declined') ||
        monthDesigns.some(d => d.status === 'declined')
      ) {
        monthsWithIssues.add(month)
      }
    }

    const pendingApprovals =
      brandTopics.filter(t => t.status === 'proposed').length +
      brandDesigns.filter(d => d.status === 'pending').length

    return {
      ...brand,
      monthsNeedingAttention: monthsWithIssues.size,
      pendingApprovals,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Planning</h2>
        <p className="text-gray-500 text-sm">Select a brand to view and manage its email marketing plan.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
        {brandStats.map(brand => (
          <BrandCard
            key={brand.id}
            brand={brand}
            monthsNeedingAttention={brand.monthsNeedingAttention}
            pendingApprovals={brand.pendingApprovals}
          />
        ))}
      </div>
    </div>
  )
}
