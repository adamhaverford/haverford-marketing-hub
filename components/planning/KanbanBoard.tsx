'use client'

import { useMemo } from 'react'

interface Brand {
  id: string
  name: string
  color: string
}

interface Campaign {
  id: string
  brand_id: string
  title: string
  type: string
  month: string | null
  status: string
  brands: { name: string; color: string } | null
}

interface Props {
  campaigns: Campaign[]
  brands: Brand[]
  filterBrand: string
  filterMonth: string
  onSelectCampaign: (id: string) => void
}

const COLUMNS: { id: string; label: string; color: string; dot: string }[] = [
  { id: 'idea', label: 'Idea', color: 'bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
  { id: 'proposed', label: 'Proposed', color: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  { id: 'approved', label: 'Approved', color: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
  { id: 'declined', label: 'Declined', color: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  { id: 'in_production', label: 'In Production', color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-500' },
  { id: 'scheduled', label: 'Scheduled', color: 'bg-purple-50 border-purple-200', dot: 'bg-purple-500' },
  { id: 'sent', label: 'Sent', color: 'bg-teal-50 border-teal-200', dot: 'bg-teal-500' },
]

function formatMonth(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
}

export default function KanbanBoard({
  campaigns,
  filterBrand,
  filterMonth,
  onSelectCampaign,
}: Props) {
  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (filterBrand && c.brand_id !== filterBrand) return false
      if (filterMonth && c.month) {
        const campaignMonth = c.month.slice(0, 7)
        if (campaignMonth !== filterMonth) return false
      } else if (filterMonth && !c.month) {
        return false
      }
      return true
    })
  }, [campaigns, filterBrand, filterMonth])

  const byStatus = useMemo(() => {
    const map: Record<string, Campaign[]> = {}
    for (const col of COLUMNS) map[col.id] = []
    for (const c of filtered) {
      if (map[c.status]) map[c.status].push(c)
    }
    return map
  }, [filtered])

  const totalVisible = filtered.length

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-500">No campaigns yet</p>
        <p className="text-sm mt-1">Create your first campaign using the button above.</p>
      </div>
    )
  }

  if (totalVisible === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium text-gray-500">No campaigns match your filters</p>
        <p className="text-sm mt-1">Try adjusting the brand or month filter.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map((col) => {
          const cards = byStatus[col.id] ?? []
          return (
            <div key={col.id} className="w-64 flex-shrink-0">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                {cards.length > 0 && (
                  <span className="ml-auto text-xs text-gray-400 font-medium">{cards.length}</span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                {cards.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => onSelectCampaign(campaign.id)}
                    className="w-full text-left rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]/20"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: campaign.brands?.color ?? '#1B2B4B' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2">
                          {campaign.title}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              campaign.type === 'evergreen'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {campaign.type}
                          </span>
                          {campaign.month && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {formatMonth(campaign.month)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {campaign.brands?.name ?? ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Empty column placeholder */}
              {cards.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-gray-100 p-4 text-center">
                  <p className="text-xs text-gray-300">Empty</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
