'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getBrandCost(brandId: string, month: string): Promise<number | null> {
  const supabase = createAdminClient()
  const { data: monthlyCost } = await supabase
    .from('brand_monthly_costs')
    .select('cost')
    .eq('brand_id', brandId)
    .eq('month', month)
    .single()
  if (monthlyCost) return monthlyCost.cost

  const { data: brand } = await supabase
    .from('brands')
    .select('default_monthly_cost')
    .eq('id', brandId)
    .single()
  return brand?.default_monthly_cost ?? null
}

export async function upsertBrandCost(brandId: string, month: string, cost: number): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('brand_monthly_costs')
    .upsert(
      { brand_id: brandId, month, cost, updated_at: new Date().toISOString() },
      { onConflict: 'brand_id,month' },
    )
  if (error) throw new Error(error.message)
  revalidatePath('/performance')
}
