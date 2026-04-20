import { createClient } from '@/lib/supabase/server'
import AttentionPanel from '@/components/planning/AttentionPanel'
import { formatMonthLabel } from '@/lib/utils'
import type { SectionStatus } from '@/components/planning/MonthBlock'

interface Brand {
  id: string
  name: string
  color: string
  description: string | null
}

const STATUS_CONFIG: Record<SectionStatus, { label: string; bg: string; text: string; dot: string }> = {
  no_topics:       { label: 'No topics',       bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   },
  topics_proposed: { label: 'Topics proposed', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  topics_approved: { label: 'Topics approved', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  design_uploaded: { label: 'Design uploaded', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  design_approved: { label: 'Design approved', bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  scheduled:       { label: 'Scheduled',       bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
}

function calcStatus(
  topics: { brand_id: string; month: string; type: string; status: string }[],
  designs: { brand_id: string; month: string; type: string; status: string; is_current: boolean }[],
  brandId: string,
  month: string,
  type: string,
): SectionStatus {
  const mDesigns = designs.filter(d => d.brand_id === brandId && d.month === month && d.type === type)
  const mTopics  = topics.filter(t  => t.brand_id === brandId && t.month === month && t.type === type)
  if (mDesigns.some(d => d.is_current && d.status === 'approved')) return 'design_approved'
  if (mDesigns.some(d => d.is_current && d.status === 'pending'))  return 'design_uploaded'
  if (mTopics.some(t => t.status === 'approved'))                  return 'topics_approved'
  if (mTopics.length > 0)                                          return 'topics_proposed'
  return 'no_topics'
}

function StatusPill({ status, typeLabel }: { status: SectionStatus; typeLabel: string }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-white/60 text-[10px] font-medium">{typeLabel}</p>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {cfg.label}
      </span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  const twoMonths = [currentMonth, nextMonth]

  const [
    { data: brands },
    { data: planningTopics },
    { data: planningDesigns },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, color, description').eq('active', true).order('name'),
    supabase.from('planning_topics').select('brand_id, month, type, status').in('month', twoMonths),
    supabase.from('planning_designs').select('brand_id, month, type, status, is_current').in('month', twoMonths),
  ])

  const brandList  = (brands ?? []) as Brand[]
  const topicList  = (planningTopics  ?? []) as { brand_id: string; month: string; type: string; status: string }[]
  const designList = (planningDesigns ?? []) as { brand_id: string; month: string; type: string; status: string; is_current: boolean }[]

  const monthRows = [
    { month: currentMonth, label: formatMonthLabel(currentMonth) },
    { month: nextMonth,    label: formatMonthLabel(nextMonth) },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Overview</h2>
        <p className="text-gray-500">Welcome to the Haverford Marketing Hub.</p>
      </div>

      <AttentionPanel />

      {/* ── Brand planning status cards ── */}
      <section className="mb-10">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Brands</h3>
        {brandList.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No active brands.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {brandList.map(brand => (
              <div
                key={brand.id}
                className="rounded-2xl p-5 text-white relative overflow-hidden"
                style={{ backgroundColor: brand.color }}
              >
                <p className="font-bold text-lg leading-tight mb-1">{brand.name}</p>
                {brand.description && (
                  <p className="text-white/70 text-xs mb-4">{brand.description}</p>
                )}

                <div className="space-y-4">
                  {monthRows.map(({ month, label }) => (
                    <div key={month}>
                      <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-2">
                        {label}
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        <StatusPill
                          status={calcStatus(topicList, designList, brand.id, month, 'evergreen')}
                          typeLabel="Evergreen"
                        />
                        <StatusPill
                          status={calcStatus(topicList, designList, brand.id, month, 'promotional')}
                          typeLabel="Promotional"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
