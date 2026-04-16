'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'

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
          <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full text-white text-[10px] font-bold"
                style={{ backgroundColor: '#E8611A' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  )
}
