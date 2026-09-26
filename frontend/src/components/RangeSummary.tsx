import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import api from '../api/client'

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const iso = (d: Date) => d.toISOString().slice(0, 10)

type PresetId = 'ytd' | '7d' | '30d' | '90d' | 'month' | '12m' | 'custom'

interface Preset {
  id: PresetId
  label: string
  range: () => { start: string; end: string }
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1)
}
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const PRESETS: Preset[] = [
  { id: 'ytd', label: 'Year to date', range: () => ({ start: iso(startOfYear(new Date())), end: iso(new Date()) }) },
  { id: '7d', label: 'Last 7 days', range: () => ({ start: iso(daysAgo(6)), end: iso(new Date()) }) },
  { id: '30d', label: 'Last 30 days', range: () => ({ start: iso(daysAgo(29)), end: iso(new Date()) }) },
  { id: '90d', label: 'Last 90 days', range: () => ({ start: iso(daysAgo(89)), end: iso(new Date()) }) },
  { id: 'month', label: 'This month', range: () => {
    const d = new Date()
    return { start: iso(new Date(d.getFullYear(), d.getMonth(), 1)), end: iso(d) }
  } },
  { id: '12m', label: 'Last 12 months', range: () => ({ start: iso(daysAgo(364)), end: iso(new Date()) }) },
]

export default function RangeSummary() {
  const [activePreset, setActivePreset] = useState<PresetId>('ytd')
  const [customStart, setCustomStart] = useState(iso(startOfYear(new Date())))
  const [customEnd, setCustomEnd] = useState(iso(new Date()))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Resolve the effective range from the active preset (or custom pickers)
  const range = useMemo(() => {
    if (activePreset === 'custom') return { start: customStart, end: customEnd }
    const preset = PRESETS.find(p => p.id === activePreset)!
    return preset.range()
  }, [activePreset, customStart, customEnd])

  useEffect(() => {
    if (!range.start || !range.end || range.start > range.end) return
    setLoading(true)
    api.get(`/analytics/range-summary?start=${range.start}&end=${range.end}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [range.start, range.end])

  const net = data ? data.net : 0

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-headline-md text-content">Period Summary</h2>
          <p className="text-body-sm text-content-variant mt-0.5">
            {data ? `${data.start} → ${data.end} · ${data.days} days` : 'Pick a range'}
          </p>
        </div>

        {/* Relative presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePreset(p.id)}
              className={`px-3 py-1.5 rounded-full text-body-sm border transition-colors ${
                activePreset === p.id
                  ? 'bg-primary text-primary-on border-primary'
                  : 'border-outline-variant text-content-variant hover:bg-surface-low'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setActivePreset('custom')}
            className={`px-3 py-1.5 rounded-full text-body-sm border transition-colors inline-flex items-center gap-1 ${
              activePreset === 'custom'
                ? 'bg-primary text-primary-on border-primary'
                : 'border-outline-variant text-content-variant hover:bg-surface-low'
            }`}
          >
            <Icon name="date_range" size={16} /> Custom
          </button>
        </div>
      </div>

      {/* Absolute custom range pickers */}
      {activePreset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-lg bg-surface-low">
          <div>
            <label className="label-caps text-content-variant block mb-1">From</label>
            <input type="date" value={customStart} max={customEnd} onChange={e => setCustomStart(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label-caps text-content-variant block mb-1">To</label>
            <input type="date" value={customEnd} min={customStart} onChange={e => setCustomEnd(e.target.value)} className="input" />
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Metric label="Income" value={data ? fmt(data.income) : '—'} icon="south_west" valueClass="text-positive" loading={loading} />
        <Metric label="Expenses" value={data ? fmt(data.expense) : '—'} icon="north_east" valueClass="text-danger" loading={loading} />
        <Metric
          label="Net"
          value={data ? `${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}` : '—'}
          icon={net >= 0 ? 'trending_up' : 'trending_down'}
          valueClass={net >= 0 ? 'text-content' : 'text-danger'}
          loading={loading}
        />
      </div>

      {data && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 pt-4 border-t border-outline-variant/40 text-body-sm text-content-variant">
          <span><span className="font-data text-content">{data.transaction_count}</span> transactions</span>
          <span>Avg daily spend <span className="font-data text-content">{fmt(data.avg_daily_expense)}</span></span>
          {data.income > 0 && <span>Savings rate <span className="font-data text-content">{data.savings_rate.toFixed(0)}%</span></span>}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, icon, valueClass, loading }: { label: string; value: string; icon: string; valueClass: string; loading: boolean }) {
  return (
    <div className="rounded-lg bg-surface-low p-4">
      <div className="flex items-center justify-between">
        <p className="label-caps text-content-variant">{label}</p>
        <span className="w-7 h-7 rounded-full bg-surface-high flex items-center justify-center text-content-variant">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`text-headline-md font-data mt-2 ${valueClass} ${loading ? 'opacity-40' : ''}`}>{value}</p>
    </div>
  )
}
