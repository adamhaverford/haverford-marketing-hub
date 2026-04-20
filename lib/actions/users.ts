'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function inviteUser(email: string, fullName: string, role: string) {
  const supabase = createAdminClient()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    ...(siteUrl && { redirectTo: `${siteUrl}/auth/confirm` }),
  })

  if (error) throw new Error(error.message)

  // Ensure profile has the right role and email (trigger may race)
  if (data.user) {
    await supabase
      .from('profiles')
      .update({ role, full_name: fullName, email })
      .eq('user_id', data.user.id)
  }

  return { success: true }
}
