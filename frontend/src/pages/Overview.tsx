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
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTransactions, setDrillTransactions] = useState<any[]>([])

  const [year, mon] = month.split('-').map(Number)

  useEffect(() => {
    api.get(`/analytics/overview?year=${year}&month=${mon}`).then(r => setOverview(r.data))
    api.get(`/analytics/category-breakdown?year=${year}&month=${mon}`).then(r => setCategories(r.data))
    api.get(`/analytics/daily-spending?year=${year}&month=${mon}`).then(r => setDaily(r.data))
    setDrillCategory(null)
    setDrillTransactions([])
  }, [month])

  const handleCategoryClick = async (category: string) => {
    if (drillCategory === category) {
      setDrillCategory(null)
      setDrillTransactions([])
      return
    }
    setDrillCategory(category)
    // Fetch transactions for this category in this month
    const allCats = await api.get('/transactions/categories')
    const cat = allCats.data.find((c: any) => c.name === category)
    if (cat) {
      const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
      const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
      const res = await api.get(`/transactions?category_id=${cat.id}&start_date=${startDate}&end_date=${endDate}&transaction_type=expense`)
      setDrillTransactions(res.data)
    }
  }

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
          <MetricCard label="Refunds" value={overview.refund} color="text-emerald-400" />
          <MetricCard label="Net" value={overview.net} color="text-indigo-400" />
          <MetricCard label="Savings Rate" value={`${overview.savings_rate.toFixed(0)}%`} color="text-yellow-400" raw />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category breakdown — clickable */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Spending by Category</h2>
          <p className="text-xs text-gray-500 mb-3">Click a slice to see transactions</p>
          {categories.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="total"
                  nameKey="category"
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={120}
                  onClick={(_, i) => handleCategoryClick(categories[i].category)}
                  style={{ cursor: 'pointer' }}
                >
                  {categories.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke={drillCategory === categories[i].category ? '#fff' : 'none'} strokeWidth={2} />
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

      {/* Category drill-down */}
      {drillCategory && (
        <div className="bg-gray-900 border border-indigo-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{drillCategory} — {drillTransactions.length} transactions</h2>
            <button onClick={() => { setDrillCategory(null); setDrillTransactions([]) }} className="text-gray-400 hover:text-white text-sm">✕ Close</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-400">Date</th>
                  <th className="text-left px-3 py-2 text-gray-400">Description</th>
                  <th className="text-right px-3 py-2 text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {drillTransactions.map(t => (
                  <tr key={t.id} className="border-t border-gray-800">
                    <td className="px-3 py-2 text-gray-300">{t.date}</td>
                    <td className="px-3 py-2 text-gray-100">{t.description || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-100">${t.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Total: ${drillTransactions.reduce((s: number, t: any) => s + t.amount, 0).toFixed(2)}
          </p>
        </div>
      )}
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
