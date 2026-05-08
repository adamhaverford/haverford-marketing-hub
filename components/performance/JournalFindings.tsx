'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Copy, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { JournalEntry } from '@/lib/actions/journal'

const CATEGORIES = ['Subject Line', 'Copy', 'Delay', 'Filter', 'Structure', 'Split Test', 'Other'] as const

interface CategoryStat {
  category: string
  total: number
  improved: number
  worse: number
  neutral: number
  winRate: number | null
}

interface Props {
  brandName: string
  entries: JournalEntry[]
}

export default function JournalFindings({ brandName, entries }: Props) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const stats = useMemo<CategoryStat[]>(() => {
    return CATEGORIES.map(cat => {
      const catEntries = entries.filter(e => e.category === cat)
      const withOutcome = catEntries.filter(e => e.outcome !== null)
      const improved = withOutcome.filter(e => e.outcome === 'improved').length
      const worse = withOutcome.filter(e => e.outcome === 'worse').length
      const neutral = withOutcome.filter(e => e.outcome === 'neutral').length
      const winRate = withOutcome.length > 0 ? (improved / withOutcome.length) * 100 : null
      return { category: cat, total: catEntries.length, improved, worse, neutral, winRate }
    }).filter(s => s.total > 0)
  }, [entries])

  const recentWins = useMemo(() => {
    return entries
      .filter(e => e.outcome === 'improved')
      .slice(0, 3)
  }, [entries])

  const patterns = useMemo(() => {
    return stats.filter(s => s.winRate !== null && s.total >= 3)
  }, [stats])

  const strongPatterns = patterns.filter(s => (s.winRate ?? 0) >= 70)
  const weakPatterns = patterns.filter(s => (s.winRate ?? 0) <= 40)

  function buildAIContext() {
    const lines: string[] = [
      `# Flow Journal — ${brandName}`,
      `Total entries: ${entries.length} | With outcome: ${entries.filter(e => e.outcome).length}`,
      '',
      '## Win rates by category',
    ]
    for (const s of stats) {
      if (s.winRate === null) {
        lines.push(`- ${s.category}: ${s.total} entries (no outcomes logged)`)
      } else {
        lines.push(`- ${s.category}: ${Math.round(s.winRate)}% win rate (${s.improved}/${s.improved + s.worse + s.neutral} with outcome, ${s.total} total)`)
      }
    }
    if (strongPatterns.length) {
      lines.push('', '## What tends to work')
      for (const s of strongPatterns) {
        lines.push(`- ${s.category}: ${Math.round(s.winRate ?? 0)}% win rate over ${s.total} changes`)
      }
    }
    if (weakPatterns.length) {
      lines.push('', '## What tends not to work')
      for (const s of weakPatterns) {
        lines.push(`- ${s.category}: ${Math.round(s.winRate ?? 0)}% win rate over ${s.total} changes`)
      }
    }
    if (recentWins.length) {
      lines.push('', '## Recent wins')
      for (const e of recentWins) {
        lines.push(`- [${e.category}] ${e.flow_name} (${e.changed_at}): ${e.description}`)
        if (e.before_value && e.after_value) lines.push(`  Before: ${e.before_value} → After: ${e.after_value}`)
        if (e.notes) lines.push(`  Notes: ${e.notes}`)
      }
    }
    return lines.join('\n')
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildAIContext())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleCSV() {
    const headers = ['Date', 'Flow', 'Category', 'Description', 'Before', 'After', 'Notes', 'Outcome', 'Logged By']
    const rows = entries.map(e => [
      e.changed_at,
      e.flow_name,
      e.category,
      e.description,
      e.before_value ?? '',
      e.after_value ?? '',
      e.notes ?? '',
      e.outcome ?? '',
      e.logged_by_name ?? '',
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flow-journal-${brandName.toLowerCase().replace(/\s+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (entries.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">Findings Summary</span>
          <span className="text-xs text-gray-400 font-normal">· {entries.filter(e => e.outcome).length} outcomes logged</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-5">
          {/* Category win rates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Win rates by category</p>
            <div className="space-y-2">
              {stats.map(s => (
                <div key={s.category} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 flex-shrink-0">{s.category}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    {s.winRate !== null && (
                      <div
                        className="h-full rounded-full bg-orange-400 transition-all"
                        style={{ width: `${s.winRate}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right flex-shrink-0">
                    {s.winRate !== null
                      ? `${Math.round(s.winRate)}% (${s.improved}/${s.improved + s.worse + s.neutral})`
                      : `${s.total} logged`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          {(strongPatterns.length > 0 || weakPatterns.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {strongPatterns.length > 0 && (
                <div className="rounded-xl border border-green-100 bg-green-50/50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-green-700">Tends to work</span>
                  </div>
                  <ul className="space-y-1">
                    {strongPatterns.map(s => (
                      <li key={s.category} className="text-xs text-green-700">
                        {s.category} · <span className="font-semibold">{Math.round(s.winRate ?? 0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {weakPatterns.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-semibold text-red-600">Tends not to work</span>
                  </div>
                  <ul className="space-y-1">
                    {weakPatterns.map(s => (
                      <li key={s.category} className="text-xs text-red-600">
                        {s.category} · <span className="font-semibold">{Math.round(s.winRate ?? 0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Recent wins */}
          {recentWins.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent wins</p>
              <div className="space-y-2">
                {recentWins.map(e => (
                  <div key={e.id} className="flex gap-2 text-xs text-gray-600">
                    <Minus className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>
                      <span className="font-medium text-gray-700">{e.flow_name}</span>
                      {' — '}
                      {e.description}
                      {e.before_value && e.after_value && (
                        <span className="text-gray-400 ml-1">({e.before_value} → {e.after_value})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy as AI context'}
            </button>
            <button
              onClick={handleCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3 h-3" />
              Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
