import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { ToastProvider } from '@/components/Toast'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('user_id', user.id)
    .single()

  const fullName = profile?.full_name ?? user.email ?? 'User'
  const role = profile?.role ?? 'marketing'

  let unreadCount = 0
  if (role === 'stakeholder' && profile?.id) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
    unreadCount = count ?? 0
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar fullName={fullName} role={role} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header title="Haverford Marketing Hub" role={role} unreadCount={unreadCount} />
          <main className="flex-1 bg-white">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
