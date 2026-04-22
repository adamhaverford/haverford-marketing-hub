'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { MonthData, monthLabel } from '@/lib/performance'

interface SpamChartProps {
  data: MonthData[]
}

function barColor(rate: number | null): string {
  if (rate === null) return '#e5e7eb'
  if (rate > 0.1)  return '#dc2626'
  if (rate > 0.05) return '#d97706'
  return '#22c55e'
}

export default function SpamChart({ data }: SpamChartProps) {
  const chartData = data
    .filter(r => r.sent !== null)
    .map(r => ({
      month: monthLabel(r.month),
      spamRate: r.spamRate,
    }))

  const hasData = chartData.some(d => d.spamRate !== null)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">No spam rate data yet for this year.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-white">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `${v}%`}
            width={40}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(3)}%`, 'Spam Rate']}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '13px',
            }}
          />
          <ReferenceLine
            y={0.1}
            stroke="#dc2626"
            strokeDasharray="4 4"
            label={{ value: '0.1% danger', position: 'right', fontSize: 10, fill: '#dc2626' }}
          />
          <ReferenceLine
            y={0.05}
            stroke="#d97706"
            strokeDasharray="4 4"
            label={{ value: '0.05% warning', position: 'right', fontSize: 10, fill: '#d97706' }}
          />
          <Bar dataKey="spamRate" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.spamRate)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-3 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-green-500" /> {`< 0.05%`} Good
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-amber-500" /> 0.05–0.1% Warning
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-3 h-3 rounded bg-red-600" /> {`> 0.1%`} Danger
        </div>
      </div>
    </div>
  )
}
