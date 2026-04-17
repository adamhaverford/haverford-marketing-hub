'use client'

import NotificationBell from './NotificationBell'

interface HeaderProps {
  title: string
  role: string
  unreadCount?: number
}

export default function Header({ title, role, unreadCount = 0 }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-4">
        {role === 'stakeholder' && (
          <NotificationBell unreadCount={unreadCount} />
        )}
      </div>
    </header>
  )
}
