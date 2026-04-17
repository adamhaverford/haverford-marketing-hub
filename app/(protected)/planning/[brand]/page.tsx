import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MonthBlock, { SectionStatus } from '@/components/planning/MonthBlock'
import { getUpcomingMonths } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: { brand: string }
}

function calcStatus(
  topics: { month: string; type: string; status: string }[],
  designs: { month: string; type: string; status: string; is_current: boolean }[],
  month: string,
  type: string,
): SectionStatus {
  const monthDesigns = designs.filter(d => d.month === month && d.type === type)
  const monthTopics = topics.filter(t => t.month === month && t.type === type)

  if (monthDesigns.some(d => d.is_current && d.status === 'approved')) return 'design_approved'
  if (monthDesigns.some(d => d.is_current && d.status === 'pending')) return 'design_uploaded'
  if (monthTopics.some(t => t.status === 'approved')) return 'topics_approved'
  if (monthTopics.length > 0) return 'topics_proposed'
  return 'no_topics'
}

export default async function BrandYearPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color, description')
    .eq('id', params.brand)
    .eq('active', true)
    .single()

  if (!brand) notFound()

  const months = getUpcomingMonths(12)
  const now = new Date()

  const [{ data: topics }, { data: designs }] = await Promise.all([
    supabase
      .from('planning_topics')
      .select('month, type, status')
      .eq('brand_id', brand.id)
      .in('month', months),
    supabase
      .from('planning_designs')
      .select('month, type, status, is_current')
      .eq('brand_id', brand.id)
      .in('month', months),
  ])

  const topicList = (topics ?? []) as { month: string; type: string; status: string }[]
  const designList = (designs ?? []) as { month: string; type: string; status: string; is_current: boolean }[]

  const monthData = months.map((month, i) => {
    const [y, m] = month.split('-').map(Number)
    const monthDate = new Date(y, m - 1, 1)
    const isPast = monthDate < new Date(now.getFullYear(), now.getMonth(), 1)

    const evergreenStatus = calcStatus(topicList, designList, month, 'evergreen')
    const promotionalStatus = calcStatus(topicList, designList, month, 'promotional')

    const hasPendingAction =
      topicList.some(t => t.month === month && t.status === 'proposed') ||
      designList.some(d => d.month === month && d.is_current && d.status === 'pending')

    return { month, evergreenStatus, promotionalStatus, hasPendingAction, isPast }
  })

  return (
    <div className="p-8">
      {/* Back + heading */}
      <div className="mb-8">
        <Link
          href="/planning"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All brands
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-3 h-8 rounded-full" style={{ backgroundColor: brand.color }} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{brand.name}</h2>
            {brand.description && (
              <p className="text-gray-400 text-sm">{brand.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Year grid: 4×3 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {monthData.map(({ month, evergreenStatus, promotionalStatus, hasPendingAction, isPast }) => (
          <MonthBlock
            key={month}
            brandId={brand.id}
            month={month}
            evergreenStatus={evergreenStatus}
            promotionalStatus={promotionalStatus}
            hasPendingAction={hasPendingAction}
            isPast={isPast}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-4 text-xs text-gray-500">
        {[
          { label: 'No topics', color: 'bg-gray-100 text-gray-500' },
          { label: 'Topics proposed', color: 'bg-yellow-100 text-yellow-700' },
          { label: 'Topics approved', color: 'bg-blue-100 text-blue-700' },
          { label: 'Design uploaded', color: 'bg-orange-100 text-orange-700' },
          { label: 'Design approved', color: 'bg-green-100 text-green-700' },
        ].map(({ label, color }) => (
          <span key={label} className={`px-2.5 py-1 rounded-full font-medium ${color}`}>
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
          Action pending
        </span>
      </div>
    </div>
  )
}
