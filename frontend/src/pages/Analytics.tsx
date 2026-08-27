import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

export default function Analytics() {
  const [trends, setTrends] = useState<any[]>([])
  const [drill, setDrill] = useState<{ month: string; type: string } | null>(null)
  const [drillTransactions, setDrillTransactions] = useState<any[]>([])

  useEffect(() => {
    api.get('/analytics/trends?months=12').then(r => setTrends(r.data))
  }, [])

  const chartData = trends.map(t => ({
    month: `${t.year}-${String(t.month).padStart(2, '0')}`,
    year: t.year,
    monthNum: t.month,
    Income: t.income,
    Expenses: t.expense,
    Net: t.income - t.expense,
  }))

  const loadDrill = async (year: number, month: number, type: string, label: string) => {
    const key = `${label}-${type}`
    if (drill && `${drill.month}-${drill.type}` === key) {
      setDrill(null)
      setDrillTransactions([])
      return
    }
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
    const res = await api.get(`/transactions?start_date=${startDate}&end_date=${endDate}&transaction_type=${type}&limit=500`)
    setDrill({ month: label, type })
    setDrillTransactions(res.data)
  }

  // Handle bar click — recharts passes the data point
  const handleBarClick = (data: any, type: string) => {
    if (data && data.year) {
      loadDrill(data.year, data.monthNum, type, data.month)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Analytics</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Income vs Expenses (12 months)</h2>
        <p className="text-xs text-gray-500 mb-4">Click a bar to view that month's transactions</p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151' }} formatter={(v: number) => `$${v.toLocaleString()}`} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => handleBarClick(d, 'income')} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => handleBarClick(d, 'expense')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-12">Not enough data</p>
        )}
      </div>

      {/* Drill-down with search */}
      {drill && drillTransactions.length > 0 && (
        <TransactionList
          transactions={drillTransactions}
          title={`${drill.month} — ${drill.type.charAt(0).toUpperCase() + drill.type.slice(1)}`}
          onClose={() => { setDrill(null); setDrillTransactions([]) }}
        />
      )}

      {drill && drillTransactions.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500">
          No {drill.type} transactions for {drill.month}
        </div>
      )}
    </div>
  )
}
