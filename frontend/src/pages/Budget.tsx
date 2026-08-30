import { useEffect, useState } from 'react'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

const BUCKET_META: Record<string, { label: string; color: string; bar: string; desc: string }> = {
  needs: { label: 'Needs', color: 'text-blue-400', bar: 'bg-blue-500', desc: 'Rent, groceries, utilities, transport, insurance' },
  wants: { label: 'Wants', color: 'text-amber-400', bar: 'bg-amber-500', desc: 'Dining, shopping, entertainment, subscriptions' },
  savings: { label: 'Savings & Investments', color: 'text-emerald-400', bar: 'bg-emerald-500', desc: 'Emergency fund, stocks, ETFs, retirement' },
}

export default function Budget() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [analysis, setAnalysis] = useState<any>(null)
  const [suggestion, setSuggestion] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [allocations, setAllocations] = useState<Record<number, number>>({})
  const [categories, setCategories] = useState<any[]>([])
  const [months, setMonths] = useState<string[]>([])
  const [budgetedMonths, setBudgetedMonths] = useState<string[]>([])

  // Category drill-down
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [drillTransactions, setDrillTransactions] = useState<any[]>([])

  const [year, mon] = month.split('-').map(Number)

  const loadAnalysis = () => {
    api.get(`/budget/${year}/${mon}/analysis`).then(r => setAnalysis(r.data))
    setDrillCategory(null)
    setDrillTransactions([])
  }

  const loadBudgetedMonths = () => {
    api.get('/budget/months-with-budget').then(r => setBudgetedMonths(r.data))
  }

  useEffect(() => {
    loadAnalysis()
    api.get('/transactions/categories').then(r => setCategories(r.data.filter((c: any) => ['expense', 'investment', 'savings'].includes(c.category_type))))
  }, [month])

  useEffect(() => {
    api.get('/analytics/available-months?future=3').then(r => setMonths(r.data))
    loadBudgetedMonths()
  }, [])

  const dateRange = () => {
    const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
    const endDate = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`
    return { startDate, endDate }
  }

  const handleCategoryClick = async (categoryName: string) => {
    if (drillCategory === categoryName) {
      setDrillCategory(null)
      setDrillTransactions([])
      return
    }
    const cat = categories.find((c: any) => c.name === categoryName)
    if (!cat) return
    const { startDate, endDate } = dateRange()
    const res = await api.get(`/transactions?category_id=${cat.id}&start_date=${startDate}&end_date=${endDate}&limit=500`)
    setDrillCategory(categoryName)
    setDrillTransactions(res.data)
  }

  const handleBucketClick = async (bucketName: string) => {
    const label = bucketName.charAt(0).toUpperCase() + bucketName.slice(1)
    if (drillCategory === label) {
      setDrillCategory(null)
      setDrillTransactions([])
      return
    }
    // Find all categories in this bucket (from the analysis category list)
    const bucketCats = (analysis?.categories || []).filter((c: any) => c.bucket === bucketName)
    const catIds = bucketCats
      .map((bc: any) => categories.find((c: any) => c.name === bc.category)?.id)
      .filter(Boolean)
    if (catIds.length === 0) return

    const { startDate, endDate } = dateRange()
    // Fetch transactions for each category and merge
    const results = await Promise.all(
      catIds.map((id: number) =>
        api.get(`/transactions?category_id=${id}&start_date=${startDate}&end_date=${endDate}&limit=500`)
      )
    )
    const merged = results.flatMap(r => r.data).sort((a: any, b: any) => b.date.localeCompare(a.date))
    setDrillCategory(label)
    setDrillTransactions(merged)
  }

  const startSetup = async () => {
    const [sugg, existing] = await Promise.all([
      api.get('/budget/suggest?months_back=3'),
      api.get(`/budget/${year}/${mon}`),
    ])
    setSuggestion(sugg.data)
    const alloc: Record<number, number> = {}
    if (existing.data.exists) {
      existing.data.categories.forEach((c: any) => { alloc[c.category_id] = c.amount })
    } else {
      sugg.data.categories.forEach((s: any) => {
        const cat = categories.find((c: any) => c.name === s.category)
        if (cat) alloc[cat.id] = s.suggested
      })
    }
    setAllocations(alloc)
    setEditing(true)
  }

  const saveBudget = async () => {
    const payload = {
      year, month: mon,
      allocations: Object.entries(allocations).map(([id, amt]) => ({ category_id: +id, amount: amt })),
    }
    await api.post('/budget/', payload)
    setEditing(false)
    loadAnalysis()
    loadBudgetedMonths()
  }

  const hasBudget = analysis?.has_budget

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Budget</h1>
          {analysis && (
            hasBudget ? (
              <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded-full">● Budget set</span>
            ) : (
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">○ No budget</span>
            )
          )}
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            {months.map(m => {
              const budgeted = budgetedMonths.includes(m)
              return (
                <option key={m} value={m}>
                  {budgeted ? '● ' : '○ '}{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              )
            })}
          </select>
          <button onClick={startSetup} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">
            {hasBudget ? 'Edit Budget' : 'Set Up Budget'}
          </button>
        </div>
      </div>

      {/* Legend for indicators */}
      <div className="flex gap-4 mb-4 text-xs text-gray-500">
        <span>● = budget configured</span>
        <span>○ = no budget (spending only)</span>
      </div>

      {/* Editing mode */}
      {editing && suggestion && (
        <BudgetEditor
          suggestion={suggestion}
          categories={categories}
          allocations={allocations}
          setAllocations={setAllocations}
          onSave={saveBudget}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Analysis / spending view */}
      {!editing && analysis && (
        <>
          {hasBudget ? (
            <BudgetAnalysis analysis={analysis} onCategoryClick={handleCategoryClick} onBucketClick={handleBucketClick} activeDrill={drillCategory} />
          ) : (
            <NoBudgetView analysis={analysis} onCategoryClick={handleCategoryClick} onBucketClick={handleBucketClick} activeDrill={drillCategory} onSetup={startSetup} />
          )}

          {/* Category drill-down */}
          {drillCategory && drillTransactions.length > 0 && (
            <div className="mt-6">
              <TransactionList
                transactions={drillTransactions}
                title={drillCategory}
                onClose={() => { setDrillCategory(null); setDrillTransactions([]) }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function NoBudgetView({ analysis, onCategoryClick, onBucketClick, activeDrill, onSetup }: any) {
  const { overall, buckets, categories } = analysis

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-amber-800/40 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-white font-medium">No budget set for this month</p>
          <p className="text-gray-400 text-sm">Here's your actual spending. Set a budget to track against it.</p>
        </div>
        <button onClick={onSetup} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm whitespace-nowrap">Set Up Budget</button>
      </div>

      {/* Spending total */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <p className="text-xs text-gray-500 uppercase tracking-wide">Total Spending</p>
        <p className="text-2xl font-bold text-white mt-1">${overall.spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
      </div>

      {/* Bucket spending (no budget bars, just totals) — clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {buckets.map((b: any) => {
          const meta = BUCKET_META[b.bucket]
          const active = activeDrill === b.bucket.charAt(0).toUpperCase() + b.bucket.slice(1)
          return (
            <button
              key={b.bucket}
              onClick={() => onBucketClick(b.bucket)}
              className={`text-left bg-gray-900 border rounded-xl p-5 transition-colors ${active ? 'border-indigo-600' : 'border-gray-800 hover:border-gray-600'}`}
            >
              <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-gray-500 mb-3">{meta.desc}</p>
              <p className="text-xl font-bold text-white">${b.spent.toFixed(0)}</p>
              <p className="text-xs text-gray-500">spent · click to view</p>
            </button>
          )
        })}
      </div>

      {/* Category spending — clickable */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">Spending by Category</h2>
        <p className="text-xs text-gray-500 mb-4">Click a category to see its transactions</p>
        <div className="space-y-2">
          {categories.filter((c: any) => c.spent > 0).map((c: any) => (
            <button
              key={c.category}
              onClick={() => onCategoryClick(c.category)}
              className={`w-full flex justify-between items-center text-sm px-3 py-2 rounded-lg transition-colors ${activeDrill === c.category ? 'bg-indigo-900/30 border border-indigo-700' : 'hover:bg-gray-800 border border-transparent'}`}
            >
              <span className="text-gray-200">{c.icon} {c.category}</span>
              <span className="text-gray-400 font-mono">${c.spent.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BudgetAnalysis({ analysis, onCategoryClick, onBucketClick, activeDrill }: any) {
  const { overall, buckets, categories, alerts } = analysis

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 font-medium text-sm mb-2">⚠ Over Budget</p>
          {alerts.map((a: string, i: number) => (
            <p key={i} className="text-red-300 text-xs">{a}</p>
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="text-lg font-semibold text-white">Overall</h2>
          <span className="text-sm text-gray-400">
            ${overall.spent.toLocaleString('en-US', { maximumFractionDigits: 0 })} of ${overall.budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <ProgressBar pct={overall.pct} over={overall.spent > overall.budget} />
        <p className="text-xs text-gray-500 mt-2">
          {overall.remaining >= 0
            ? `$${overall.remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })} remaining`
            : `$${Math.abs(overall.remaining).toLocaleString('en-US', { maximumFractionDigits: 0 })} over budget`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {buckets.map((b: any) => {
          const meta = BUCKET_META[b.bucket]
          const active = activeDrill === b.bucket.charAt(0).toUpperCase() + b.bucket.slice(1)
          return (
            <button
              key={b.bucket}
              onClick={() => onBucketClick(b.bucket)}
              className={`text-left bg-gray-900 border rounded-xl p-5 transition-colors ${active ? 'border-indigo-600' : 'border-gray-800 hover:border-gray-600'}`}
            >
              <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-gray-500 mb-3">{meta.desc}</p>
              <ProgressBar pct={b.pct} over={b.over} barColor={meta.bar} />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-400">${b.spent.toFixed(0)} spent</span>
                <span className="text-gray-500">${b.budget.toFixed(0)} budget</span>
              </div>
            </button>
          )
        })}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-1">By Category</h2>
        <p className="text-xs text-gray-500 mb-4">Click a category to see its transactions</p>
        <div className="space-y-4">
          {categories.filter((c: any) => c.budget > 0 || c.spent > 0).map((c: any) => (
            <button
              key={c.category}
              onClick={() => onCategoryClick(c.category)}
              className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${activeDrill === c.category ? 'bg-indigo-900/30 border border-indigo-700' : 'hover:bg-gray-800 border border-transparent'}`}
            >
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-200">{c.icon} {c.category}</span>
                <span className={c.over ? 'text-red-400' : 'text-gray-400'}>
                  ${c.spent.toFixed(0)} / ${c.budget.toFixed(0)}
                </span>
              </div>
              <ProgressBar pct={c.pct} over={c.over} thin />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BudgetEditor({ suggestion, categories, allocations, setAllocations, onSave, onCancel }: any) {
  const total = Object.values(allocations).reduce((s: number, v: any) => s + (+v || 0), 0)

  return (
    <div className="bg-gray-900 border border-indigo-800 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Set Your Budget</h2>
          <p className="text-xs text-gray-500">Suggested from your last {suggestion.months_analyzed} months. Adjust as needed.</p>
        </div>
        <span className="text-lg font-bold text-indigo-400">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo</span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {categories.map((cat: any) => {
          const sugg = suggestion.categories.find((s: any) => s.category === cat.name)
          return (
            <div key={cat.id} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-200 flex-1">{cat.icon} {cat.name}</span>
              {sugg && <span className="text-xs text-gray-500">avg ${sugg.avg}</span>}
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  value={allocations[cat.id] || 0}
                  onChange={e => setAllocations({ ...allocations, [cat.id]: +e.target.value })}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm w-24 text-right"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm">Save Budget</button>
        <button onClick={onCancel} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm">Cancel</button>
      </div>
    </div>
  )
}

function ProgressBar({ pct, over, barColor = 'bg-indigo-500', thin = false }: { pct: number; over?: boolean; barColor?: string; thin?: boolean }) {
  const width = Math.min(pct, 100)
  const color = over ? 'bg-red-500' : barColor
  return (
    <div className={`w-full bg-gray-800 rounded-full ${thin ? 'h-1.5' : 'h-3'}`}>
      <div className={`${color} ${thin ? 'h-1.5' : 'h-3'} rounded-full transition-all`} style={{ width: `${width}%` }} />
    </div>
  )
}
