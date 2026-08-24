import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../api/client'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

export default function Overview() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [overview, setOverview] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [daily, setDaily] = useState<any[]>([])

  const [year, mon] = month.split('-').map(Number)

  useEffect(() => {
    api.get(`/analytics/overview?year=${year}&month=${mon}`).then(r => setOverview(r.data))
    api.get(`/analytics/category-breakdown?year=${year}&month=${mon}`).then(r => setCategories(r.data))
    api.get(`/analytics/daily-spending?year=${year}&month=${mon}`).then(r => setDaily(r.data))
  }, [month])

  const months = Array.from({ length: 24 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white"
        />
      </div>

      {/* Metrics */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <MetricCard label="Income" value={overview.income} color="text-green-400" />
          <MetricCard label="Expenses" value={overview.expense} color="text-red-400" />
          <MetricCard label="Payments" value={overview.payment} color="text-blue-400" />
          <MetricCard label="Net" value={overview.net} color="text-indigo-400" />
          <MetricCard label="Savings Rate" value={`${overview.savings_rate.toFixed(0)}%`} color="text-yellow-400" raw />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Spending by Category</h2>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total"
                  nameKey="category"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={120}
                  label={({ category, total }) => `${category}: $${total.toFixed(0)}`}
                  labelLine={false}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data</p>
          )}
        </div>

        {/* Daily spending */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Daily Spending</h2>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={daily}>
                <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={d => d.split('-')[2]} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} />
                <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">No data</p>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color, raw }: { label: string; value: any; color: string; raw?: boolean }) {
  const display = raw ? value : `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{display}</p>
    </div>
  )
}
