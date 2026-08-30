import { useEffect, useState } from 'react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import Icon from '../components/Icon'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

// Target monthly savings rate (%). Frontend owns this threshold; adjust here.
const SAVINGS_RATE_TARGET = 20

// Tonal donut palette — steel blue / slate / muted purple variations (no rainbow)
const DONUT_COLORS = ['#4c5e8b', '#585f72', '#6b5680', '#a8bbee', '#cdd4eb', '#d9bfef', '#aeb2bc']

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
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
  const sortedCats = [...categories].sort((a, b) => b.total - a.total)
  const categoryRows = sortedCats
    .slice(0, 6)
    .map(c => ({ ...c, delta: c.total - (prevByCat[c.category] || 0) }))

  // Donut data — top 6 categories + "Other" rollup
  const totalSpend = sortedCats.reduce((s, c) => s + c.total, 0)
  const donutTop = sortedCats.slice(0, 6)
  const donutOther = sortedCats.slice(6).reduce((s, c) => s + c.total, 0)
  const donutData = [
    ...donutTop.map(c => ({ name: c.category, value: c.total })),
    ...(donutOther > 0 ? [{ name: 'Other', value: donutOther }] : []),
  ]

  return (
    <div className="flex flex-col gap-gutter">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-display-lg text-content">Overview</h1>
          <p className="text-body-lg text-content-variant mt-1">Your financial snapshot for {new Date(year, mon - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="input w-auto"
        />
      </div>

      {/* Bento — hero cashflow + trend (8col) | spending donut + AI card (4col) */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left: net cashflow hero + 6-month trend */}
          <div className="lg:col-span-8 card p-6 flex flex-col justify-between">
            <div>
              <p className="label-caps text-content-variant">Net Cashflow · {new Date(year, mon - 1).toLocaleDateString('en-US', { month: 'short' })}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <h2 className={`text-display-lg ${cashflow >= 0 ? 'text-content' : 'text-danger'}`}>
                  {fmtSigned(cashflow)}
                </h2>
                {prevOverview && (
                  <DeltaChip value={cashflowDelta} goodWhenPositive />
                )}
              </div>
              <p className="text-body-sm text-content-variant mt-1">
                {cashflow >= 0 ? 'surplus this month' : 'deficit this month'}
                {prevOverview && ` · vs ${fmtSigned(prevCashflow)} last month`}
              </p>
            </div>
            <div className="h-56 w-full mt-4">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dfe2ed" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#5b5f68', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#5b5f68', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #aeb2bc', borderRadius: '8px', color: '#2f323b' }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Income" stroke="#4c5e8b" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Expenses" stroke="#a83836" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-content-variant text-center py-12">Not enough data</p>
              )}
            </div>
          </div>

          {/* Right column stack */}
          <div className="lg:col-span-4 flex flex-col gap-gutter">
            {/* Spending donut */}
            <div className="card p-6 flex-1 flex flex-col">
              <p className="label-caps text-content-variant mb-3">Monthly Spending</p>
              <div className="relative flex-1 flex items-center justify-center min-h-[200px]">
                {donutData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
                          {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#ffffff', border: '1px solid #aeb2bc', borderRadius: '8px' }}
                          formatter={(v: number) => fmt(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-body-sm text-content-variant">Total</span>
                      <span className="text-headline-md text-content">{fmt(totalSpend)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-content-variant">No spending this month</p>
                )}
              </div>
            </div>

            {/* AI insight card */}
            <div className="rounded-lg bg-primary-fixed border border-primary-fixed-dim p-6 relative overflow-hidden group cursor-default">
              <div className="flex items-start gap-3 relative z-10">
                <div className="p-2 bg-primary-on-fixed text-primary-fixed rounded-lg" style={{ backgroundColor: '#192d57' }}>
                  <Icon name="smart_toy" />
                </div>
                <div>
                  <h4 className="text-headline-md text-primary-on-fixed" style={{ color: '#192d57' }}>
                    {savingsRateMessageTitle(overview.savings_rate)}
                  </h4>
                  <p className="text-body-sm mt-1" style={{ color: '#384a76' }}>
                    {savingsRateMessageBody(overview.savings_rate, SAVINGS_RATE_TARGET)}
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                <Icon name="auto_awesome" size={120} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextual KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Income"
            value={fmt(overview.income)}
            delta={prevOverview ? pctChange(overview.income, prevOverview.income) : null}
            goodWhenPositive
            icon="south_west"
            onClick={() => handleTypeDrill('income')}
            active={drillType === 'income'}
          />
          <KpiCard
            label="Expenses"
            value={fmt(overview.expense)}
            delta={prevOverview ? pctChange(overview.expense, prevOverview.expense) : null}
            goodWhenPositive={false}
            icon="north_east"
            sub={overview.income ? `${Math.round((overview.expense / overview.income) * 100)}% of income` : undefined}
            onClick={() => handleTypeDrill('expense')}
            active={drillType === 'expense'}
          />
          <SavingsRateCard rate={overview.savings_rate} target={SAVINGS_RATE_TARGET} />
          {netWorth && (
            <KpiCard
              label="Net Worth"
              value={fmt(netWorth.net_worth)}
              icon="account_balance"
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

      {/* Where it went + net worth breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Category breakdown — horizontal bars with MoM delta */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-headline-md text-content">Where your money went</h2>
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
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="text-content font-medium">{c.icon} {c.category}</span>
                        <span className="flex items-center gap-3">
                          <span className="font-data text-content">{fmt(c.total)}</span>
                          {c.delta !== 0 && (
                            <span className={`text-xs font-medium ${c.delta > 0 ? 'text-danger' : 'text-positive'}`}>
                              {c.delta > 0 ? '▲' : '▼'} {fmt(Math.abs(c.delta))}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${max ? (c.total / max) * 100 : 0}%` }} />
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
        <div className="card p-6">
          <h2 className="text-headline-md text-content mb-4">Net worth</h2>
          {netWorth ? (
            <>
              <p className="text-headline-lg font-data text-content">{fmt(netWorth.net_worth)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Assets" value={fmt(netWorth.total_assets)} valueClass="font-data text-positive" />
                <Row label="Liabilities" value={fmt(netWorth.total_liabilities)} valueClass="font-data text-danger" />
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant/40 space-y-2 text-sm">
                {Object.entries(netWorth.breakdown)
                  .filter(([, v]) => (v as number) !== 0)
                  .map(([type, v]) => (
                    <Row key={type} label={type.replace('_', ' ')} value={fmt(v as number)} valueClass="font-data text-content" />
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

function savingsRateMessageTitle(rate: number): string {
  if (rate >= 30) return 'Strong savings'
  if (rate >= 20) return 'On track'
  if (rate >= 0) return 'Room to save'
  return 'Overspending'
}

function savingsRateMessageBody(rate: number, target: number): string {
  if (rate >= target) return `You saved ${rate.toFixed(0)}% of income this month, above your ${target}% target. Nice work keeping discretionary spend low.`
  if (rate >= 0) return `You saved ${rate.toFixed(0)}% of income, below your ${target}% target. Trimming your top spend category could close the gap.`
  return `You spent more than you earned this month. Review your largest categories below to find quick wins.`
}

function DeltaChip({ value, goodWhenPositive }: { value: number; goodWhenPositive: boolean }) {
  const up = value >= 0
  const good = goodWhenPositive ? up : !up
  return (
    <span className={`chip label-caps gap-1 ${good ? 'bg-secondary-container text-secondary-on-container' : 'bg-danger-container/40 text-danger-dim'}`}>
      <Icon name={up ? 'trending_up' : 'trending_down'} size={14} />
      {fmtSigned(value)}
    </span>
  )
}

function KpiCard({
  label, value, delta, goodWhenPositive = true, sub, icon, onClick, active,
}: {
  label: string
  value: string
  delta?: number | null
  goodWhenPositive?: boolean
  sub?: string
  icon?: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <div
      className={`card p-5 ${active ? '!border-primary ring-1 ring-primary' : ''} ${onClick ? 'cursor-pointer hover:border-outline-variant' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <p className="label-caps text-content-variant">{label}</p>
        {icon && (
          <span className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center text-content-variant">
            <Icon name={icon} size={18} />
          </span>
        )}
      </div>
      <p className="text-headline-md font-data text-content mt-2">{value}</p>
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
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps text-content-variant">Savings Rate</p>
        <span className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center text-content-variant">
          <Icon name="savings" size={18} />
        </span>
      </div>
      <p className={`text-headline-md font-data mt-2 ${onTrack ? 'text-positive' : 'text-tertiary'}`}>
        {rate.toFixed(0)}%
      </p>
      <div className="relative h-2 bg-surface-container rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full ${onTrack ? 'bg-positive' : 'bg-tertiary'}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-outline" style={{ left: `${Math.min(100, (target / (target * 1.5)) * 100)}%` }} />
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
