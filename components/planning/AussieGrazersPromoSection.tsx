'use client'

import { useState, useEffect } from 'react'
import MonthSection, { type Topic, type Design } from './MonthSection'
import AussieGrazersFrameworkSection from './AussieGrazersFrameworkSection'

interface Props {
  brandId: string
  month: string
  topics: Topic[]
  designs: Design[]
  role: 'marketing' | 'stakeholder'
}

export default function AussieGrazersPromoSection({ brandId, month, topics, designs, role }: Props) {
  const storageKey = `ag-framework-mode-${month}`
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
          className="flex items-center gap-2.5 group"
          title={frameworkMode ? 'Switch to Standard Mode' : 'Switch to Framework Mode'}
        >
          <span className={`text-xs font-medium transition-colors ${frameworkMode ? 'text-purple-600' : 'text-gray-400'}`}>
            Framework Mode
          </span>
          <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${frameworkMode ? 'bg-purple-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${frameworkMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>

      {frameworkMode ? (
        <AussieGrazersFrameworkSection
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
