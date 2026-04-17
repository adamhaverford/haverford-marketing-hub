import { createClient } from '@/lib/supabase/server'
import AttentionPanel from '@/components/planning/AttentionPanel'

interface Brand {
  id: string
  name: string
  color: string
  description: string | null
}

interface SnapshotRow {
  brand_id: string
  open_rate: number | null
}

interface CampaignRow {
  id: string
  brand_id: string
  status: string
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

const statusColors: Record<string, string> = {
  idea: 'bg-gray-100 text-gray-700',
  proposed: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  in_production: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  sent: 'bg-teal-100 text-teal-700',
}

const activityIcon: Record<string, string> = {
  created: '✦',
  approved: '✓',
  declined: '✗',
  design_uploaded: '⬆',
}

const activityColor: Record<string, string> = {
  created: 'text-blue-600 bg-blue-50',
  approved: 'text-green-600 bg-green-50',
  declined: 'text-red-600 bg-red-50',
  design_uploaded: 'text-purple-600 bg-purple-50',
}

export default async function DashboardPage() {
  const supabase = createClient()

  const now = new Date()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]

  const [
    { data: brands },
    { data: allCampaigns },
    { data: snapshots },
    { data: recentApprovals },
    { data: recentDesigns },
  ] = await Promise.all([
    supabase.from('brands').select('id, name, color, description').eq('active', true).order('name'),
    supabase.from('campaigns').select('id, brand_id, status'),
    supabase
      .from('performance_snapshots')
      .select('brand_id, open_rate')
      .eq('month', prevMonthStart),
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
  ])

  // Also fetch recent campaign creations
  const { data: recentCampaigns } = await supabase
    .from('campaigns')
    .select('id, title, created_at, brands(name, color)')
    .order('created_at', { ascending: false })
    .limit(10)

  // Build per-brand stats
  const campaignList = (allCampaigns ?? []) as CampaignRow[]
  const snapshotMap: Record<string, number | null> = {}
  ;(snapshots ?? []).forEach((s: SnapshotRow) => {
    snapshotMap[s.brand_id] = s.open_rate
  })

  const brandStats = (brands ?? []).map((brand: Brand) => {
    const brandCampaigns = campaignList.filter(c => c.brand_id === brand.id)
    const awaitingApproval = brandCampaigns.filter(c => c.status === 'proposed').length
    const awaitingDesign = brandCampaigns.filter(c => c.status === 'in_production').length
    const lastOpenRate = snapshotMap[brand.id] ?? null

    return {
      ...brand,
      total: brandCampaigns.length,
      awaitingApproval,
      awaitingDesign,
      lastOpenRate,
    }
  })

  // Build unified activity feed
  const activityItems: ActivityItem[] = []

  ;(recentCampaigns ?? []).forEach((c: { id: string; title: string; created_at: string; brands: { name: string; color: string }[] | null }) => {
    activityItems.push({
      id: `c-${c.id}`,
      type: 'created',
      label: `Campaign created: ${c.title}`,
      brandName: c.brands?.[0]?.name ?? 'Unknown',
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
      brandName: camp?.brands?.[0]?.name ?? 'Unknown',
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
      brandName: camp?.brands?.[0]?.name ?? 'Unknown',
      brandColor: camp?.brands?.[0]?.color ?? '#1B2B4B',
      at: d.uploaded_at,
    })
  })

  activityItems.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const feed = activityItems.slice(0, 10)

  // Recent campaigns for the old list (still useful)
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, title, status, brands(name, color)')
    .order('created_at', { ascending: false })
    .limit(8)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Overview</h2>
        <p className="text-gray-500">Welcome to the Haverford Marketing Hub.</p>
      </div>

      <AttentionPanel />

      {/* Brand summary cards — 2×2 grid */}
      <section className="mb-10">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Brands</h3>
        {brandStats.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No active brands.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {brandStats.map(brand => (
              <div
                key={brand.id}
                className="rounded-2xl p-5 text-white relative overflow-hidden"
                style={{ backgroundColor: brand.color }}
              >
                <p className="font-bold text-lg leading-tight mb-1">{brand.name}</p>
                {brand.description && (
                  <p className="text-white/70 text-xs mb-4">{brand.description}</p>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-white/60 text-xs">Total campaigns</p>
                    <p className="text-white font-bold text-xl">{brand.total}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Awaiting approval</p>
                    <p className="text-white font-bold text-xl">{brand.awaitingApproval}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Awaiting design</p>
                    <p className="text-white font-bold text-xl">{brand.awaitingDesign}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">Last open rate</p>
                    <p className="text-white font-bold text-xl">
                      {brand.lastOpenRate !== null ? `${brand.lastOpenRate}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent campaigns */}
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
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {campaign.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity feed */}
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
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 mt-0.5 ${activityColor[item.type]}`}
                  >
                    {activityIcon[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{item.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.brandColor }}
                      />
                      <p className="text-xs text-gray-400">{item.brandName}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                    {timeAgo(item.at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
