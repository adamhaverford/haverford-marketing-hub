'use client'

import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { MonthData, monthLabel, fmtRate, fmtCount, fmtCurrency } from '@/lib/performance'

interface SendReportModalProps {
  brand: string
  year: number
  month: MonthData
  onClose: () => void
}

export default function SendReportModal({ brand, year, month, onClose }: SendReportModalProps) {
  const [copied, setCopied] = useState(false)

  const label = `${monthLabel(month.month)} ${year}`

  const lines = [
    `📊 ${brand} Email Performance — ${label}`,
    '',
    `Emails Sent: ${fmtCount(month.sent)}`,
    `Open Rate: ${fmtRate(month.openRate)}`,
    `Click Rate: ${fmtRate(month.clickRate)}`,
    `Click-to-Open Rate: ${fmtRate(month.ctor)}`,
    `Unsubscribe Rate: ${fmtRate(month.unsubRate)}`,
    `Bounce Rate: ${fmtRate(month.bounceRate)}`,
    `Spam Rate: ${fmtRate(month.spamRate)}`,
    `New Subscribers: ${fmtCount(month.subscribed)}`,
    `Revenue: ${fmtCurrency(month.revenue)}`,
  ]

  const text = lines.join('\n')

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Monthly Report — {label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-3">Copy this summary to share with your team.</p>

        <pre className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed mb-4">
          {text}
        </pre>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              copied
                ? 'bg-green-500 text-white'
                : 'text-white'
            }`}
            style={copied ? undefined : { backgroundColor: '#E8611A' }}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
