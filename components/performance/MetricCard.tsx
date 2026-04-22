import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  trend?: 'up' | 'down' | 'flat' | null
  trendLabel?: string
  highlight?: boolean
}

export default function MetricCard({ label, value, subValue, trend, trendLabel, highlight }: MetricCardProps) {
  const trendIcon =
    trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> :
    trend === 'down' ? <TrendingDown className="w-3.5 h-3.5" /> :
    <Minus className="w-3.5 h-3.5" />

  const trendColor =
    trend === 'up' ? 'text-green-600' :
    trend === 'down' ? 'text-red-600' :
    'text-gray-400'

  return (
    <div className={`rounded-2xl border p-5 bg-white transition-colors ${highlight ? 'border-orange-200 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mb-2">{subValue}</p>}
      {trendLabel && (
        <div className={`flex items-center gap-1 ${trendColor}`}>
          {trendIcon}
          <span className="text-xs font-medium">{trendLabel}</span>
        </div>
      )}
    </div>
  )
}
