import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { ArrowUp, ArrowDown } from 'lucide-react'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

// Target monthly savings rate (%). Frontend owns this threshold; adjust here.
const SAVINGS_RATE_TARGET = 20

const fmt = (n: number) =>
  `$${Math.round(n).toLocaleString('en-US')}`

const fmtSigned = (n: number) =>
  `${n >= 0 ? '+' : '-'}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

function prevMonth(year: number, month: number) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export default function Overview() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [overview, setOverview] = useState<any>(null)
  const [prevOverview, setPrevOverview] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [prevCategories, setPrevCategories] = useState<any[]>([])
  const [trends, setTrends] = useState<any[]>([])
  const [netWorth, setNetWorth] = useState<any>(null)

  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTransactions, setDrillTransactions] = useState<any[]>([])
  const [drillType, setDrillType] = useState<string | null>(null)
  const [drillTypeTransactions, setDrillTypeTransactions] = useState<any[]>([])

  const [year, mon] = month.split('-').map(Number)
  const prev = prevMonth(year, mon)

  useEffect(() => {
    api.get(`/analytics/overview?year=${year}&month=${mon}`).then(r => setOverview(r.data))
    api.get(`/analytics/overview?year=${prev.year}&month=${prev.month}`).then(r => setPrevOverview(r.data))
    api.get(`/analytics/category-breakdown?year=${year}&month=${mon}`).then(r => setCategories(r.data))
    api.get(`/analytics/category-breakdown?year=${prev.year}&month=${prev.month}`).then(r => setPrevCategories(r.data))
    api.get(`/analytics/trends?months=6`).then(r => setTrends(r.data))
    api.get(`/accounts/net-worth`).then(r => setNetWorth(r.data))
    setDrillCategory(null)
    setDrillTransactions([])
    setDrillType(null)
    setDrillTypeTransactions([])
  }, [month])

  const handleTypeDrill = async (type: string) => {
    if (drillType === type) {
      setDrillType(null)
      setDrillTypeTransactions([])
      return
    }
    setDrillType(type)
    setDrillCategory(null)
    setDrillTransactions([])
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
    const res = await api.get(`/transactions?start_date=${startDate}&end_date=${endDate}&transaction_type=${type}&limit=500`)
    setDrillTypeTransactions(res.data)
  }

  const handleCategoryClick = async (category: string) => {
    if (drillCategory === category) {
      setDrillCategory(null)
      setDrillTransactions([])
      return
    }
    setDrillCategory(category)
    const allCats = await api.get('/transactions/categories')
    const cat = allCats.data.find((c: any) => c.name === category)
    if (cat) {
      const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
      const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
      const [expRes, refRes] = await Promise.all([
        api.get(`/transactions?category_id=${cat.id}&start_date=${startDate}&end_date=${endDate}&transaction_type=expense`),
        api.get(`/transactions?category_id=${cat.id}&start_date=${startDate}&end_date=${endDate}&transaction_type=refund`),
      ])
      const expenses = expRes.data.map((t: any) => ({ ...t, isRefund: false }))
      const refunds = refRes.data.map((t: any) => ({ ...t, isRefund: true }))
      setDrillTransactions([...expenses, ...refunds].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  // ---- Derived values ----
  const cashflow = overview ? overview.net : 0
  const prevCashflow = prevOverview ? prevOverview.net : 0
  const cashflowDelta = cashflow - prevCashflow

  const trendData = trends.map(t => ({
    label: new Date(t.year, t.month - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
    Income: t.income,
    Expenses: t.expense,
  }))

  // Category rows with delta vs previous month, top 6 by spend
  const prevByCat: Record<string, number> = {}
  prevCategories.forEach(c => { prevByCat[c.category] = c.total })
  const categoryRows = [...categories]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(c => ({
      ...c,
      delta: c.total - (prevByCat[c.category] || 0),
    }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-content">Overview</h1>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-surface-container border border-outline-variant/50 rounded-lg px-4 py-2 text-sm text-content"
        />
      </div>

      {/* ZONE 1 — THE VERDICT */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Net cashflow hero */}
          <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6 flex flex-col justify-center">
            <p className="text-xs text-content-variant uppercase tracking-wide">Net Cashflow</p>
            <p className={`text-4xl font-bold mt-2 ${cashflow >= 0 ? 'text-content' : 'text-danger'}`}>
              {fmtSigned(cashflow)}
            </p>
            <p className="text-sm mt-1 text-content-variant">
              {cashflow >= 0 ? 'surplus this month' : 'deficit this month'}
            </p>
            {prevOverview && (
              <div className="flex items-center gap-1 mt-3 text-sm">
                <DeltaBadge value={cashflowDelta} goodWhenPositive />
                <span className="text-content-variant">vs last month ({fmtSigned(prevCashflow)})</span>
              </div>
            )}
          </div>

          {/* 6-month cashflow trend — the main story */}
          <div className="lg:col-span-2 bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6">
            <h2 className="text-sm font-semibold text-content-variant mb-3">Income vs Expenses — last 6 months</h2>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#dfe2ed" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#5b5f68', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#5b5f68', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: '#ffffff', border: '1px solid #aeb2bc', borderRadius: '8px', color: '#2f323b' }}
                    formatter={(v: number) => fmt(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Income" stroke="#4c5e8b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Expenses" stroke="#a83836" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-content-variant text-center py-12">Not enough data</p>
            )}
          </div>
        </div>
      )}

      {/* ZONE 2 — CONTEXTUAL KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard
            label="Income"
            value={fmt(overview.income)}
            delta={prevOverview ? pctChange(overview.income, prevOverview.income) : null}
            goodWhenPositive
            onClick={() => handleTypeDrill('income')}
            active={drillType === 'income'}
          />
          <KpiCard
            label="Expenses"
            value={fmt(overview.expense)}
            delta={prevOverview ? pctChange(overview.expense, prevOverview.expense) : null}
            goodWhenPositive={false}
            sub={overview.income ? `${Math.round((overview.expense / overview.income) * 100)}% of income` : undefined}
            onClick={() => handleTypeDrill('expense')}
            active={drillType === 'expense'}
          />
          <SavingsRateCard rate={overview.savings_rate} target={SAVINGS_RATE_TARGET} />
          {netWorth && (
            <KpiCard
              label="Net Worth"
              value={fmt(netWorth.net_worth)}
              sub={`${fmt(netWorth.total_assets)} assets`}
            />
          )}
        </div>
      )}

      {/* Type drill-down (income/refund/expense) */}
      {drillType && drillTypeTransactions.length > 0 && (
        <TransactionList
          transactions={drillTypeTransactions}
          title={drillType.charAt(0).toUpperCase() + drillType.slice(1)}
          onClose={() => { setDrillType(null); setDrillTypeTransactions([]) }}
        />
      )}

      {/* ZONE 3 — WHERE IT WENT + ACCOUNTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Category breakdown — horizontal bars with MoM delta */}
        <div className="lg:col-span-2 bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold text-content">Where your money went</h2>
            <span className="text-xs text-content-variant">Δ vs last month · click a row for detail</span>
          </div>
          {categoryRows.length > 0 ? (
            <div className="mt-4 space-y-2">
              {(() => {
                const max = Math.max(...categoryRows.map(c => c.total))
                return categoryRows.map(c => {
                  const active = drillCategory === c.category
                  return (
                    <button
                      key={c.category}
                      onClick={() => handleCategoryClick(c.category)}
                      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${active ? 'bg-surface-container' : 'hover:bg-surface-container/60'}`}
                    >
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-content">{c.icon} {c.category}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-content font-medium">{fmt(c.total)}</span>
                          {c.delta !== 0 && (
                            <span className={`text-xs ${c.delta > 0 ? 'text-danger' : 'text-positive'}`}>
                              {c.delta > 0 ? '▲' : '▼'} {fmt(Math.abs(c.delta))}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${max ? (c.total / max) * 100 : 0}%` }}
                        />
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
          ) : (
            <p className="text-content-variant text-center py-12">No expenses this month</p>
          )}
        </div>

        {/* Net worth breakdown */}
        <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6">
          <h2 className="text-lg font-semibold text-content mb-4">Net worth</h2>
          {netWorth ? (
            <>
              <p className="text-3xl font-bold text-content">{fmt(netWorth.net_worth)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Assets" value={fmt(netWorth.total_assets)} valueClass="text-positive" />
                <Row label="Liabilities" value={fmt(netWorth.total_liabilities)} valueClass="text-danger" />
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant/40 space-y-2 text-sm">
                {Object.entries(netWorth.breakdown)
                  .filter(([, v]) => (v as number) !== 0)
                  .map(([type, v]) => (
                    <Row
                      key={type}
                      label={type.replace('_', ' ')}
                      value={fmt(v as number)}
                      valueClass="text-content"
                    />
                  ))}
              </div>
            </>
          ) : (
            <p className="text-content-variant text-center py-12">No accounts</p>
          )}
        </div>
      </div>

      {/* Category drill-down */}
      {drillCategory && (
        <TransactionList
          transactions={drillTransactions}
          title={drillCategory}
          onClose={() => { setDrillCategory(null); setDrillTransactions([]) }}
          showType
        />
      )}
    </div>
  )
}

function DeltaBadge({ value, goodWhenPositive }: { value: number; goodWhenPositive: boolean }) {
  const up = value >= 0
  const good = goodWhenPositive ? up : !up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-medium ${good ? 'text-positive' : 'text-danger'}`}>
      <Icon size={14} />
      {fmtSigned(value)}
    </span>
  )
}

function KpiCard({
  label, value, delta, goodWhenPositive = true, sub, onClick, active,
}: {
  label: string
  value: string
  delta?: number | null
  goodWhenPositive?: boolean
  sub?: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div
      className={`bg-surface-lowest border rounded-xl p-4 ${active ? 'border-primary' : 'border-outline-variant/40'} ${onClick ? 'cursor-pointer hover:border-outline-variant' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-content-variant uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold mt-1 text-content">{value}</p>
      <div className="flex items-center gap-2 mt-1 h-4">
        {delta != null && (
          <span className={`text-xs font-medium ${(goodWhenPositive ? delta >= 0 : delta <= 0) ? 'text-positive' : 'text-danger'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {sub && <span className="text-xs text-content-variant">{sub}</span>}
      </div>
    </div>
  )
}

function SavingsRateCard({ rate, target }: { rate: number; target: number }) {
  const onTrack = rate >= target
  const pct = Math.max(0, Math.min(100, (rate / (target * 1.5)) * 100))
  return (
    <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-4">
      <p className="text-xs text-content-variant uppercase tracking-wide">Savings Rate</p>
      <p className={`text-xl font-bold mt-1 ${onTrack ? 'text-positive' : 'text-tertiary'}`}>
        {rate.toFixed(0)}%
      </p>
      <div className="relative h-2 bg-surface-container rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full ${onTrack ? 'bg-positive' : 'bg-tertiary'}`}
          style={{ width: `${pct}%` }}
        />
        {/* target marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-300"
          style={{ left: `${Math.min(100, (target / (target * 1.5)) * 100)}%` }}
        />
      </div>
      <p className="text-xs text-content-variant mt-1">target {target}%</p>
    </div>
  )
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-content-variant capitalize">{label}</span>
      <span className={valueClass || 'text-content'}>{value}</span>
    </div>
  )
}
