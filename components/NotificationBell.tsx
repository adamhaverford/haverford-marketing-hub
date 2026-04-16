'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import { getNotifications, markNotificationRead } from '@/lib/actions/planning'

type NotificationType = 'proposal_submitted' | 'design_uploaded'

interface NotificationItem {
  id: string
  type: NotificationType
  read: boolean
  created_at: string
  campaign_id: string
  campaigns: {
    id: string
    title: string
    brands: { name: string; color: string } | null
  } | null
}

interface Props {
  unreadCount: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const TYPE_LABELS: Record<NotificationType, string> = {
  proposal_submitted: 'New proposal',
  design_uploaded: 'New design uploaded',
}

export default function NotificationBell({ unreadCount: initialCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getNotifications()
      setNotifications(data as unknown as NotificationItem[])
      setCount(data.length)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleNotificationClick = (n: NotificationItem) => {
    startTransition(async () => {
      await markNotificationRead(n.id)
      setNotifications((prev) => prev.filter((x) => x.id !== n.id))
      setCount((c) => Math.max(0, c - 1))
      setOpen(false)
      router.push(`/planning?campaign=${n.campaign_id}`)
      router.refresh()
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
            style={{ backgroundColor: '#E8611A' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No unread notifications</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.map((n) => {
                const brand = n.campaigns?.brands
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleNotificationClick(n)}
                      disabled={isPending}
                      className="w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors disabled:opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        {brand && (
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                            style={{ backgroundColor: brand.color }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-500 mb-0.5">
                            {TYPE_LABELS[n.type]}
                          </p>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {n.campaigns?.title ?? 'Campaign'}
                          </p>
                          {brand && (
                            <p className="text-xs text-gray-400">{brand.name}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
