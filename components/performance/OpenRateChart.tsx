'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { MonthData, monthLabel } from '@/lib/performance'

interface OpenRateChartProps {
  data: MonthData[]
}

export default function OpenRateChart({ data }: OpenRateChartProps) {
  const chartData = data
    .filter(r => r.sent !== null)
    .map(r => ({
      month: monthLabel(r.month),
      openRate: r.openRate,
      clickRate: r.clickRate,
    }))

  const hasData = chartData.some(d => d.openRate !== null)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-400">No open rate data yet for this year.</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-5 bg-white">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
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
            width={38}
          />
          <Tooltip
            formatter={(v, name) => [
              `${Number(v).toFixed(2)}%`,
              name === 'openRate' ? 'Open Rate' : 'Click Rate',
            ]}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              fontSize: '13px',
            }}
          />
          <ReferenceLine y={20} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: '20%', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
          <Line
            type="monotone"
            dataKey="openRate"
            name="openRate"
            stroke="#E8611A"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#E8611A', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="clickRate"
            name="clickRate"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-5 mt-3 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-6 h-0.5 bg-orange-500 rounded" />
          Open Rate
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-6 h-0.5 bg-indigo-500 rounded opacity-70" style={{ borderTop: '2px dashed' }} />
          Click Rate
        </div>
      </div>
    </div>
  )
}
