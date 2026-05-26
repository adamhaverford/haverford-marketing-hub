import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import ReportClient from './ReportClient'

export default async function ReportPage({
  params,
}: {
  params: { brand: string; month: string }
}) {
  const supabase = createAdminClient()

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, color')
    .eq('id', params.brand)
    .single()

  if (!brand) notFound()

  return (
    <ReportClient
      brandId={params.brand}
      month={params.month}
      brandColor={brand.color}
    />
  )
}
