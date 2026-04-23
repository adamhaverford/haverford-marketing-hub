'use client'

import Link from 'next/link'
import { formatMonthLabel } from '@/lib/utils'

export type SectionStatus =
  | 'no_topics'
  | 'topics_proposed'
  | 'topics_approved'
  | 'design_uploaded'
  | 'design_approved'
  | 'scheduled'

interface StatusConfig {
  label: string
  bg: string
  text: string
  dot: string
}

const STATUS_CONFIG: Record<SectionStatus, StatusConfig> = {
  no_topics:       { label: 'No topics',        bg: 'bg-gray-100',    text: 'text-gray-500',   dot: 'bg-gray-400' },
  topics_proposed: { label: 'Topics proposed',  bg: 'bg-yellow-100',  text: 'text-yellow-700', dot: 'bg-yellow-500' },
  topics_approved: { label: 'Topics approved',  bg: 'bg-blue-100',    text: 'text-blue-700',   dot: 'bg-blue-500' },
  design_uploaded: { label: 'Design uploaded',  bg: 'bg-orange-100',  text: 'text-orange-700', dot: 'bg-orange-500' },
  design_approved: { label: 'Design approved',  bg: 'bg-green-100',   text: 'text-green-700',  dot: 'bg-green-500' },
  scheduled:       { label: 'Scheduled',        bg: 'bg-purple-100',  text: 'text-purple-700', dot: 'bg-purple-500' },
}

interface MonthBlockProps {
  brandId: string
  month: string  // YYYY-MM
  evergreenStatus: SectionStatus
  promotionalStatus: SectionStatus
  hasPendingAction: boolean
  isPast: boolean
}

function StatusPill({ status }: { status: SectionStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export default function MonthBlock({
  brandId,
  month,
  evergreenStatus,
  promotionalStatus,
  hasPendingAction,
  isPast,
}: MonthBlockProps) {
  const label = formatMonthLabel(month)
  const isFullyApproved =
    evergreenStatus === 'design_approved' && promotionalStatus === 'design_approved'

  return (
    <Link
      href={`/planning/${brandId}/${month}`}
      className={`relative group flex flex-col rounded-xl border p-4 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
        isPast ? 'opacity-60' : ''
      } ${isFullyApproved ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      {/* Pending action dot */}
      {hasPendingAction && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
      )}

      {/* Month heading */}
      <p className="text-sm font-semibold text-gray-800 mb-3 pr-4">{label}</p>

      {/* Status rows */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-28 flex-shrink-0">Evergreen</span>
          <StatusPill status={evergreenStatus} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-28 flex-shrink-0">Newsletter/Promo</span>
          <StatusPill status={promotionalStatus} />
        </div>
      </div>

      {/* Fully approved indicator */}
      {isFullyApproved && (
        <div className="mt-3 flex items-center gap-1 text-xs text-green-600 font-medium">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Ready
        </div>
      )}
    </Link>
  )
}
