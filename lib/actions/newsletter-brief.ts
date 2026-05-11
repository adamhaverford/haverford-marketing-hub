'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type CrossSellProduct = {
  name: string
  oneliner: string
  price: string
  sku: string
}

export type NewsletterBrief = {
  id: string
  brand_id: string
  month: string
  hero_type: 'customer_feature' | 'seasonal_campaign' | 'product_launch' | null
  hero_headline: string | null
  hero_body: string | null
  hero_cta: string | null
  hero_image_notes: string | null
  crosssell_products: CrossSellProduct[]
  tip_headline: string | null
  tip_body: string | null
  tip_cta: string | null
  spotlight_name: string | null
  spotlight_location: string | null
  spotlight_quote: string | null
  spotlight_products: string | null
  subject_line: string | null
  preview_text: string | null
  seasonal_theme: string | null
  status: 'draft' | 'ready' | 'sent'
}

export async function getNewsletterBrief(brandId: string, month: string): Promise<NewsletterBrief | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('newsletter_briefs')
    .select('*')
    .eq('brand_id', brandId)
    .eq('month', month)
    .single()
  return data as NewsletterBrief | null
}

export async function upsertNewsletterBrief(
  brief: Partial<NewsletterBrief> & { brand_id: string; month: string },
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('newsletter_briefs')
    .upsert({ ...brief, updated_at: new Date().toISOString() }, { onConflict: 'brand_id,month' })
  if (error) throw new Error(error.message)
  revalidatePath('/planning', 'layout')
}
