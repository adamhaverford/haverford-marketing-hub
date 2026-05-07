'use client'

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import FlowJournal from '@/components/performance/FlowJournal'

interface Brand {
  id: string
  name: string
  color: string
  klaviyo_account: string | null
}

interface Props {
  brands: Brand[]
}

export default function JournalClient({ brands }: Props) {
  const [selectedBrandId, setSelectedBrandId] = useState(brands[0]?.id ?? '')

  const selectedBrand = brands.find(b => b.id === selectedBrandId)
  const noKlaviyo = selectedBrand && !selectedBrand.klaviyo_account

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Flow Journal</h2>
        <p className="text-gray-500">Track changes made to flows and measure their impact over time.</p>
      </div>

      {/* Brand selector */}
      <div className="flex items-center gap-3 mb-6">
        {selectedBrand && (
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedBrand.color }} />
        )}
        <select
          value={selectedBrandId}
          onChange={e => setSelectedBrandId(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
        >
          {brands.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* No Klaviyo account configured */}
      {noKlaviyo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold mb-1">No Klaviyo account linked for {selectedBrand.name}</p>
            <p className="text-amber-700">Set a <code className="bg-amber-100 px-1 rounded">klaviyo_account</code> on this brand to enable the Flow Journal.</p>
          </div>
        </div>
      )}

      {/* Journal */}
      {selectedBrand?.klaviyo_account && (
        <FlowJournal
          brandId={selectedBrandId}
          klaviyoAccount={selectedBrand.klaviyo_account}
        />
      )}
    </div>
  )
}
