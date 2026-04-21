'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { dismissNotification } from '@/lib/actions/planning'

interface Props {
  href: string
  message: string
  brandName: string
  brandColor: string
  className: string
  dismissId: string
}

export default function DismissibleNotificationItem({ href, message, brandName, brandColor, className, dismissId }: Props) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDismissed(true)
    await dismissNotification(dismissId)
  }

  return (
    <div className={`group ${className}`}>
      <Link href={href} className="flex-1 flex items-center gap-3 min-w-0">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColor }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{message}</p>
          <p className="text-xs text-gray-500">{brandName}</p>
        </div>
      </Link>
      <button
        onClick={handleDismiss}
        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-black/10 text-gray-400 hover:text-gray-600"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
