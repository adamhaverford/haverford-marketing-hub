'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface BrandCardProps {
  brand: {
    id: string
    name: string
    color: string
    description: string | null
  }
}

export default function BrandCard({ brand }: BrandCardProps) {
  return (
    <Link
      href={`/planning/${brand.id}`}
      className="group relative flex flex-col rounded-2xl border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
      style={{ borderColor: brand.color + '33' }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: brand.color }} />

      <div className="flex-1 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-gray-700 transition-colors">
              {brand.name}
            </h3>
            {brand.description && (
              <p className="text-gray-400 text-sm mt-0.5">{brand.description}</p>
            )}
          </div>
          <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors mt-0.5 flex-shrink-0" />
        </div>
      </div>

      <div className="h-1 w-full opacity-20" style={{ backgroundColor: brand.color }} />
    </Link>
  )
}
