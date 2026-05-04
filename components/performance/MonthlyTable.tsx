import { MonthData, BlendedMonth, monthLabel, fmtRate, fmtCount, fmtCurrency } from '@/lib/performance'

interface MonthlyTableProps {
  data: MonthData[]
  currentMonth: string
  blendedMonthly?: BlendedMonth[]
}

export default function MonthlyTable({ data, currentMonth, blendedMonthly = [] }: MonthlyTableProps) {
  const cols = [
    { key: 'month',        label: 'Month',        align: 'left'  },
    { key: 'sent',         label: 'Sent',          align: 'right' },
    { key: 'openRate',     label: 'Open Rate',     align: 'right' },
    { key: 'clickRate',    label: 'Click Rate',    align: 'right' },
    { key: 'ctor',         label: 'CTOR',          align: 'right' },
    { key: 'unsubRate',    label: 'Unsub',         align: 'right' },
    { key: 'bounceRate',   label: 'Bounce',        align: 'right' },
    { key: 'revenue',      label: 'Revenue',       align: 'right' },
    { key: 'netSubscribers', label: 'Net Subs',      align: 'right' },
  ] as const

  function fmt(row: MonthData, key: typeof cols[number]['key']): string {
    if (key === 'month')      return monthLabel(row.month)
    if (key === 'sent')       return fmtCount(row.sent)
    if (key === 'openRate') {
      const b = blendedMonthly.find(m => m.month === row.month)
      const rate = b && b.delivered > 0 ? (b.opensUnique / b.delivered) * 100 : row.openRate
      return fmtRate(rate)
    }
    if (key === 'clickRate') {
      const b = blendedMonthly.find(m => m.month === row.month)
      const rate = b && b.delivered > 0 ? (b.clicksUnique / b.delivered) * 100 : row.clickRate
      return fmtRate(rate)
    }
    if (key === 'ctor')       return fmtRate(row.ctor)
    if (key === 'unsubRate')  return fmtRate(row.unsubRate)
    if (key === 'bounceRate') return fmtRate(row.bounceRate)
    if (key === 'revenue')    return fmtCurrency(row.revenue)
    if (key === 'netSubscribers') return fmtCount(row.netSubscribers)
    return '—'
  }

  const activeRows = data.filter(r => r.sent !== null)

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/70">
            {cols.map(c => (
              <th
                key={c.key}
                className={`px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => {
            const isCurrent = row.month === currentMonth
            const hasData = row.sent !== null
            return (
              <tr
                key={row.month}
                className={`border-b border-gray-50 last:border-0 ${
                  isCurrent ? 'bg-orange-50/40' :
                  !hasData ? 'opacity-40' :
                  'hover:bg-gray-50/50'
                }`}
              >
                {cols.map(c => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 whitespace-nowrap ${
                      c.align === 'right' ? 'text-right' : ''
                    } ${
                      c.key === 'month'
                        ? `font-semibold ${isCurrent ? 'text-orange-700' : 'text-gray-700'}`
                        : 'text-gray-600'
                    } ${
                      c.key === 'sent' ? 'font-medium text-gray-900' : ''
                    }`}
                  >
                    {fmt(row, c.key)}
                  </td>
                ))}
              </tr>
            )
          })}
          {activeRows.length === 0 && (
            <tr>
              <td colSpan={cols.length} className="px-4 py-10 text-center text-sm text-gray-400 italic">
                No data available for this year yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
