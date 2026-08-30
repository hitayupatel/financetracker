import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import Icon from '../components/Icon'
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

  const handleBarClick = (data: any, type: string) => {
    if (data && data.year) {
      loadDrill(data.year, data.monthNum, type, data.month)
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      <div>
        <h1 className="text-headline-lg text-content">Analytics</h1>
        <p className="text-body-md text-content-variant mt-1">Income and spending trends across the last year.</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-headline-md text-content">Income vs Expenses</h2>
          <span className="chip label-caps bg-secondary-container text-secondary-on-container">12 Months</span>
        </div>
        <p className="text-body-sm text-content-variant mb-4">Click a bar to view that month's transactions.</p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dfe2ed" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#5b5f68', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5b5f68', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #aeb2bc', borderRadius: '8px', color: '#2f323b' }} formatter={(v: number) => `$${v.toLocaleString()}`} cursor={{ fill: 'rgba(76,94,139,0.06)' }} />
              <Legend />
              <Bar dataKey="Income" fill="#4c5e8b" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => handleBarClick(d, 'income')} />
              <Bar dataKey="Expenses" fill="#a83836" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => handleBarClick(d, 'expense')} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-content-variant text-center py-12">Not enough data</p>
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
        <div className="card p-6 text-center text-content-variant flex items-center justify-center gap-2">
          <Icon name="info" size={18} /> No {drill.type} transactions for {drill.month}
        </div>
      )}
    </div>
  )
}
