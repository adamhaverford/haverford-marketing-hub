'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { recordNotificationClick } from '@/lib/actions/planning'

interface Props {
  href: string
  message: string
  brandName: string
  brandColor: string
  className: string
  entityId: string
  entityType: 'topic' | 'design'
}

export default function CommentNotificationItem({
  href, message, brandName, brandColor, className, entityId, entityType,
}: Props) {
  const router = useRouter()

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    await recordNotificationClick(entityId, entityType)
    router.push(href)
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{message}</p>
        <p className="text-xs text-gray-500">{brandName}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </a>
  )
}
