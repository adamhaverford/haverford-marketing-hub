import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BrandCard from '@/components/planning/BrandCard'

export default async function PlanningPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, color, description')
    .eq('active', true)
    .order('name')

  if (!brands || brands.length === 0) {
    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Planning</h2>
        <p className="text-gray-400 text-sm">No active brands found.</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Planning</h2>
        <p className="text-gray-500 text-sm">Select a brand to view and manage its email marketing plan.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl">
        {brands.map(brand => (
          <BrandCard key={brand.id} brand={brand} />
        ))}
      </div>
    </div>
  )
}
