import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/client'

export default function Analytics() {
  const [trends, setTrends] = useState<any[]>([])

  useEffect(() => {
    api.get('/analytics/trends?months=12').then(r => setTrends(r.data))
  }, [])

  const chartData = trends.map(t => ({
    month: `${t.year}-${String(t.month).padStart(2, '0')}`,
    Income: t.income,
    Expenses: t.expense,
    Net: t.income - t.expense,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Income vs Expenses (12 months)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-12">Not enough data</p>
        )}
      </div>
    </div>
  )
}
