'use client'

import { useEffect, useState } from 'react'
import { Plus, SlidersHorizontal } from 'lucide-react'
import KanbanBoard from './KanbanBoard'
import NewCampaignModal from './NewCampaignModal'
import CampaignDrawer from './CampaignDrawer'
import { ToastProvider } from '@/components/Toast'

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
  role: string
  initialCampaignId?: string
}

export default function PlanningClient({ campaigns, brands, role, initialCampaignId }: Props) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    initialCampaignId ?? null,
  )
  const [showNewModal, setShowNewModal] = useState(false)
  const [filterBrand, setFilterBrand] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  useEffect(() => {
    if (initialCampaignId) setSelectedCampaignId(initialCampaignId)
  }, [initialCampaignId])

  return (
    <ToastProvider>
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Campaign Planning</h2>
              <p className="text-gray-500 text-sm">
                Manage and plan your email campaigns across all brands.
              </p>
            </div>
            {role === 'marketing' && (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#E8611A' }}
              >
                <Plus className="w-4 h-4" />
                New Campaign
              </button>
            )}
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2B4B] min-w-[140px]"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B2B4B]"
            />
            {(filterBrand || filterMonth) && (
              <button
                onClick={() => { setFilterBrand(''); setFilterMonth('') }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 px-8 py-6 overflow-auto">
          <KanbanBoard
            campaigns={campaigns}
            brands={brands}
            filterBrand={filterBrand}
            filterMonth={filterMonth}
            onSelectCampaign={setSelectedCampaignId}
          />
        </div>
      </div>

      {/* New Campaign Modal */}
      {showNewModal && (
        <NewCampaignModal
          brands={brands}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Campaign Drawer */}
      {selectedCampaignId && (
        <CampaignDrawer
          campaignId={selectedCampaignId}
          brands={brands}
          role={role}
          onClose={() => setSelectedCampaignId(null)}
        />
      )}
    </ToastProvider>
  )
}
