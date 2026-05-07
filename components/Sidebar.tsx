'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/auth/actions'
import {
  LayoutDashboard,
  CalendarDays,
  Lightbulb,
  BarChart2,
  BookOpen,
  Settings,
  LogOut,
} from 'lucide-react'

interface SidebarProps {
  fullName: string
  role: string
}

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard, marketingOnly: false },
  { label: 'Planning',    href: '/planning',     icon: CalendarDays,    marketingOnly: false },
  { label: 'Brainstorm',  href: '/brainstorm',   icon: Lightbulb,       marketingOnly: false },
  { label: 'Performance', href: '/performance',  icon: BarChart2,       marketingOnly: false },
  { label: 'Flow Journal', href: '/journal',    icon: BookOpen,        marketingOnly: false },
  { label: 'Settings',    href: '/settings',     icon: Settings,        marketingOnly: true },
]

export default function Sidebar({ fullName, role }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="flex flex-col w-64 min-h-screen"
      style={{ backgroundColor: '#1B2B4B' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{ backgroundColor: '#E8611A' }}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Haverford</p>
          <p className="text-blue-300 text-xs">Marketing Hub</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.filter(item => !item.marketingOnly || role === 'marketing').map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
              style={active ? { backgroundColor: '#E8611A' } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User info + sign out */}
      <div className="px-4 py-5 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#E8611A' }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{fullName}</p>
            <p className="text-blue-300 text-xs capitalize">{role}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-3 py-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
