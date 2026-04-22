import { AlertTriangle, CheckCircle, Info } from 'lucide-react'
import { MonthData, monthLabel, fmtRate, fmtCount, spamColor, spamBg } from '@/lib/performance'
import SpamChart from './SpamChart'

interface SpamTabProps {
  data: MonthData[]
  year: number
}

function SpamStatusBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-gray-400 text-xs">—</span>
  if (rate > 0.1)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
        <AlertTriangle className="w-3 h-3" /> Danger
      </span>
    )
  if (rate > 0.05)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
        <AlertTriangle className="w-3 h-3" /> Warning
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
      <CheckCircle className="w-3 h-3" /> Good
    </span>
  )
}

export default function SpamTab({ data, year }: SpamTabProps) {
  const activeData = data.filter(r => r.sent !== null)
  const dangerMonths  = activeData.filter(r => (r.spamRate ?? 0) > 0.1)
  const warningMonths = activeData.filter(r => (r.spamRate ?? 0) > 0.05 && (r.spamRate ?? 0) <= 0.1)

  return (
    <div className="space-y-8">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <span className="font-semibold">Google & Yahoo Spam Thresholds:</span>{' '}
          Keep spam rates below <span className="font-semibold">0.10%</span> to avoid delivery issues.
          Rates above <span className="font-semibold">0.08%</span> risk throttling; above <span className="font-semibold">0.30%</span> risk blocking.
          Monitor the{' '}
          <a href="https://postmaster.google.com" target="_blank" rel="noreferrer" className="underline font-medium">
            Google Postmaster Dashboard
          </a>{' '}
          for domain reputation.
        </div>
      </div>

      {/* Alert summary */}
      {(dangerMonths.length > 0 || warningMonths.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dangerMonths.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">Danger Zone</span>
              </div>
              <p className="text-xs text-red-700">
                {dangerMonths.map(r => monthLabel(r.month)).join(', ')} exceeded 0.10% spam rate.
              </p>
            </div>
          )}
          {warningMonths.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">Warning</span>
              </div>
              <p className="text-xs text-amber-700">
                {warningMonths.map(r => monthLabel(r.month)).join(', ')} were between 0.05–0.10%.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Spam chart */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          Spam Rate by Month — {year}
        </h3>
        <SpamChart data={data} />
      </div>

      {/* Spam table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
          Detailed Breakdown
        </h3>
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Month</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Sent</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Spam Reports</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Spam Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Unsub Rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Bounce Rate</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const hasData = row.sent !== null
                return (
                  <tr
                    key={row.month}
                    className={`border-b border-gray-50 last:border-0 ${spamBg(row.spamRate)} ${!hasData ? 'opacity-40' : 'hover:bg-gray-50/30'}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-700">{monthLabel(row.month)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.sent)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtCount(row.spam)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${spamColor(row.spamRate)}`}>{fmtRate(row.spamRate)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtRate(row.unsubRate)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{fmtRate(row.bounceRate)}</td>
                    <td className="px-4 py-3"><SpamStatusBadge rate={row.spamRate} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
