'use client'

import Link from 'next/link'
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

interface BrandCardProps {
  brand: {
    id: string
    name: string
    color: string
    description: string | null
  }
  monthsNeedingAttention: number
  pendingApprovals: number
}

export default function BrandCard({ brand, monthsNeedingAttention, pendingApprovals }: BrandCardProps) {
  const hasIssues = monthsNeedingAttention > 0 || pendingApprovals > 0
  const allOnTrack = !hasIssues

  return (
    <Link
      href={`/planning/${brand.id}`}
      className="group relative flex flex-col rounded-2xl border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
      style={{ borderColor: brand.color + '33' }}
    >
      {/* Colour accent stripe */}
      <div className="h-1.5 w-full" style={{ backgroundColor: brand.color }} />

      <div className="flex-1 p-6">
        {/* Brand name */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
              {brand.name}
            </h3>
            {brand.description && (
              <p className="text-gray-400 text-sm mt-0.5">{brand.description}</p>
            )}
          </div>
          <ArrowRight
            className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5 flex-shrink-0"
          />
        </div>

        {/* Status summary */}
        {allOnTrack ? (
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            All months on track
          </div>
        ) : (
          <div className="space-y-1.5">
            {monthsNeedingAttention > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                {monthsNeedingAttention} month{monthsNeedingAttention !== 1 ? 's' : ''} need attention
              </div>
            )}
            {pendingApprovals > 0 && (
              <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                </div>
                {pendingApprovals} awaiting approval
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom colour band */}
      <div
        className="h-1 w-full opacity-20"
        style={{ backgroundColor: brand.color }}
      />
    </Link>
  )
}
