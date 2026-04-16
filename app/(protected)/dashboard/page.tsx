import { createClient } from '@/lib/supabase/server'

interface CampaignRow {
  id: string
  title: string
  status: string
  brands: { name: string; color: string }[] | null
}

export default async function DashboardPage() {
  const supabase = createClient()

  const [{ data: brands }, { data: campaigns }] = await Promise.all([
    supabase.from('brands').select('*').eq('active', true).order('name'),
    supabase.from('campaigns').select('id, title, status, brands(name, color)').order('created_at', { ascending: false }).limit(10),
  ])

  const statusColors: Record<string, string> = {
    idea: 'bg-gray-100 text-gray-700',
    proposed: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    in_production: 'bg-yellow-100 text-yellow-700',
    scheduled: 'bg-purple-100 text-purple-700',
    sent: 'bg-teal-100 text-teal-700',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Overview</h2>
        <p className="text-gray-500">Welcome to the Haverford Marketing Hub.</p>
      </div>

      {/* Brands grid */}
      <section className="mb-10">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Brands</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(brands ?? []).map((brand) => (
            <div
              key={brand.id}
              className="rounded-2xl p-5 text-white"
              style={{ backgroundColor: brand.color }}
            >
              <p className="font-bold text-lg leading-tight">{brand.name}</p>
              {brand.description && (
                <p className="text-white/70 text-xs mt-1">{brand.description}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Recent campaigns */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Campaigns</h3>
        {(campaigns ?? []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No campaigns yet</p>
            <p className="text-sm mt-1">Head to Planning to create your first campaign.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(campaigns as CampaignRow[]).map((campaign) => (
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
    </div>
  )
}
