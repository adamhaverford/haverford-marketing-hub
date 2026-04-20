import { createClient } from '@/lib/supabase/server'
import AttentionPanel from '@/components/planning/AttentionPanel'
import { formatMonthLabel } from '@/lib/utils'
import type { SectionStatus } from '@/components/planning/MonthBlock'

// ── Interfaces ────────────────────────────────────────────────────
interface Brand {
  id: string
  name: string
  color: string
  description: string | null
}

interface JoinedCampaign {
  title: string
  brands: { name: string; color: string }[]
}

interface ApprovalRow {
  id: string
  campaign_id: string
  action: string
  actioned_at: string
  campaigns: JoinedCampaign[] | null
}

interface DesignRow {
  id: string
  campaign_id: string
  uploaded_at: string
  campaigns: JoinedCampaign[] | null
}

interface ActivityItem {
  id: string
  type: 'created' | 'approved' | 'declined' | 'design_uploaded'
  label: string
  brandName: string
  brandColor: string
  at: string
}

// ── Helpers ───────────────────────────────────────────────────────
function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
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

const statusColors: Record<string, string> = {
  idea:          'bg-gray-100 text-gray-700',
  proposed:      'bg-blue-100 text-blue-700',
  approved:      'bg-green-100 text-green-700',
  declined:      'bg-red-100 text-red-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  scheduled:     'bg-purple-100 text-purple-700',
  sent:          'bg-teal-100 text-teal-700',
}

const activityIcon: Record<string, string> = {
  created:         '✦',
  approved:        '✓',
  declined:        '✗',
  design_uploaded: '⬆',
}

const activityColor: Record<string, string> = {
  created:         'text-blue-600 bg-blue-50',
  approved:        'text-green-600 bg-green-50',
  declined:        'text-red-600 bg-red-50',
  design_uploaded: 'text-purple-600 bg-purple-50',
}

// ── Page ──────────────────────────────────────────────────────────
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
    { data: recentApprovals },
    { data: recentDesigns },
    { data: recentCampaigns },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, color, description').eq('active', true).order('name'),
    supabase.from('planning_topics').select('brand_id, month, type, status').in('month', twoMonths),
    supabase.from('planning_designs').select('brand_id, month, type, status, is_current').in('month', twoMonths),
    supabase
      .from('approvals')
      .select('id, campaign_id, action, actioned_at, campaigns(title, brands(name, color))')
      .order('actioned_at', { ascending: false })
      .limit(10),
    supabase
      .from('design_reviews')
      .select('id, campaign_id, uploaded_at, campaigns(title, brands(name, color))')
      .order('uploaded_at', { ascending: false })
      .limit(10),
    supabase
      .from('campaigns')
      .select('id, title, created_at, brands(name, color)')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('campaigns')
      .select('id, title, status, brands(name, color)')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const brandList  = (brands ?? []) as Brand[]
  const topicList  = (planningTopics  ?? []) as { brand_id: string; month: string; type: string; status: string }[]
  const designList = (planningDesigns ?? []) as { brand_id: string; month: string; type: string; status: string; is_current: boolean }[]

  // ── Activity feed ─────────────────────────────────────────────
  const activityItems: ActivityItem[] = []

  ;(recentCampaigns ?? []).forEach((c: { id: string; title: string; created_at: string; brands: { name: string; color: string }[] | null }) => {
    activityItems.push({
      id: `c-${c.id}`,
      type: 'created',
      label: `Campaign created: ${c.title}`,
      brandName:  c.brands?.[0]?.name  ?? 'Unknown',
      brandColor: c.brands?.[0]?.color ?? '#1B2B4B',
      at: c.created_at,
    })
  })

  ;(recentApprovals ?? []).forEach((a: ApprovalRow) => {
    const camp = Array.isArray(a.campaigns) ? a.campaigns[0] : a.campaigns
    activityItems.push({
      id: `a-${a.id}`,
      type: a.action === 'approved' ? 'approved' : 'declined',
      label: `Campaign ${a.action}: ${camp?.title ?? 'Unknown'}`,
      brandName:  camp?.brands?.[0]?.name  ?? 'Unknown',
      brandColor: camp?.brands?.[0]?.color ?? '#1B2B4B',
      at: a.actioned_at,
    })
  })

  ;(recentDesigns ?? []).forEach((d: DesignRow) => {
    const camp = Array.isArray(d.campaigns) ? d.campaigns[0] : d.campaigns
    activityItems.push({
      id: `d-${d.id}`,
      type: 'design_uploaded',
      label: `Design uploaded: ${camp?.title ?? 'Unknown'}`,
      brandName:  camp?.brands?.[0]?.name  ?? 'Unknown',
      brandColor: camp?.brands?.[0]?.color ?? '#1B2B4B',
      at: d.uploaded_at,
    })
  })

  activityItems.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const feed = activityItems.slice(0, 10)

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Recent campaigns ── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Recent Campaigns
          </h3>
          {(campaigns ?? []).length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm mt-1">Head to Planning to create your first campaign.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(campaigns ?? []).map((campaign: { id: string; title: string; status: string; brands: { name: string; color: string }[] | null }) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: campaign.brands?.[0]?.color ?? '#1B2B4B' }}
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{campaign.title}</p>
                      <p className="text-gray-400 text-xs">{campaign.brands?.[0]?.name}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {campaign.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Activity feed ── */}
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Recent Activity
          </h3>
          {feed.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-lg font-medium">No activity yet</p>
              <p className="text-sm mt-1">Activity will appear here as campaigns are created and actioned.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feed.map(item => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                >
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 ${activityColor[item.type]}`}>
                    {activityIcon[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{item.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.brandColor }} />
                      <p className="text-xs text-gray-400">{item.brandName}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{timeAgo(item.at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
