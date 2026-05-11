'use client'

import { useState, useEffect } from 'react'
import { LayoutList, BookOpen } from 'lucide-react'
import MonthSection, { type Topic, type Design } from './MonthSection'
import JPTFrameworkSection from './JPTFrameworkSection'

interface Props {
  brandId: string
  month: string
  topics: Topic[]
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

export default function JPTPromoSection({ brandId, month, topics, designs, role }: Props) {
  const storageKey = `jpt-framework-mode-${month}`
  const [frameworkMode, setFrameworkMode] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) setFrameworkMode(stored === 'true')
  }, [storageKey])

  function toggleMode() {
    const next = !frameworkMode
    setFrameworkMode(next)
    localStorage.setItem(storageKey, String(next))
  }

  return (
    <div className="rounded-2xl border-2 bg-purple-50 border-purple-200 overflow-hidden">
      {/* Section header with toggle */}
      <div className="px-6 py-4 border-b border-purple-200 bg-white/60 flex items-center justify-between">
        <h3 className="text-base font-bold text-purple-700">Promo/Newsletter</h3>
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            frameworkMode
              ? 'bg-purple-100 text-purple-700 border-purple-200'
              : 'bg-white text-gray-500 border-gray-200 hover:border-purple-200 hover:text-purple-600'
          }`}
        >
          {frameworkMode
            ? <BookOpen className="w-3.5 h-3.5" />
            : <LayoutList className="w-3.5 h-3.5" />
          }
          {frameworkMode ? 'Framework Mode' : 'Standard Mode'}
        </button>
      </div>

      {frameworkMode ? (
        <JPTFrameworkSection
          brandId={brandId}
          month={month}
          topics={topics}
          designs={designs}
          role={role}
        />
      ) : (
        <MonthSection
          brandId={brandId}
          month={month}
          type="promotional"
          topics={topics}
          designs={designs}
          role={role}
          bare
        />
      )}
    </div>
  )
}
