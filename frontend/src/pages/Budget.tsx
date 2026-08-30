import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

function CollapsibleSection({ title, subtitle, defaultOpen = true, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container/40 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          {subtitle && <p className="text-xs text-content-variant">{subtitle}</p>}
        </div>
        {open ? <ChevronDown size={18} className="text-content-variant" /> : <ChevronRight size={18} className="text-content-variant" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

const BUCKET_META: Record<string, { label: string; color: string; bar: string; desc: string }> = {
  needs: { label: 'Needs', color: 'text-primary', bar: 'bg-primary', desc: 'Rent, groceries, utilities, transport, insurance' },
  wants: { label: 'Wants', color: 'text-tertiary', bar: 'bg-tertiary', desc: 'Dining, shopping, entertainment, subscriptions' },
  savings: { label: 'Savings & Investments', color: 'text-positive', bar: 'bg-positive', desc: 'Emergency fund, stocks, ETFs, retirement' },
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
          <h1 className="text-2xl font-bold text-content">Budget</h1>
          {analysis && (
            hasBudget ? (
              <span className="text-xs bg-emerald-900/50 text-positive px-2 py-1 rounded-full">● Budget set</span>
            ) : (
              <span className="text-xs bg-surface-container text-content-variant px-2 py-1 rounded-full">○ No budget</span>
            )
          )}
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(e.target.value)} className="bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-content text-sm">
            {months.map(m => {
              const budgeted = budgetedMonths.includes(m)
              return (
                <option key={m} value={m}>
                  {budgeted ? '● ' : '○ '}{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              )
            })}
          </select>
          <button onClick={startSetup} className="bg-primary hover:bg-primary-dim text-content px-4 py-2 rounded-lg text-sm">
            {hasBudget ? 'Edit Budget' : 'Set Up Budget'}
          </button>
        </div>
      </div>

      {/* Legend for indicators */}
      <div className="flex gap-4 mb-4 text-xs text-content-variant">
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
      <div className="bg-surface-lowest border border-tertiary/40 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-content font-medium">No budget set for this month</p>
          <p className="text-content-variant text-sm">Here's your actual spending. Set a budget to track against it.</p>
        </div>
        <button onClick={onSetup} className="bg-primary hover:bg-primary-dim text-content px-5 py-2 rounded-lg text-sm whitespace-nowrap">Set Up Budget</button>
      </div>

      {/* Spending total */}
      <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6">
        <p className="text-xs text-content-variant uppercase tracking-wide">Total Spending</p>
        <p className="text-2xl font-bold text-content mt-1">${overall.spent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
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
              className={`text-left bg-surface-lowest border rounded-xl p-5 transition-colors ${active ? 'border-primary' : 'border-outline-variant/40 hover:border-outline-variant'}`}
            >
              <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-content-variant mb-3">{meta.desc}</p>
              <p className="text-xl font-bold text-content">${b.spent.toFixed(0)}</p>
              <p className="text-xs text-content-variant">spent · click to view</p>
            </button>
          )
        })}
      </div>

      {/* Category spending — clickable, collapsible */}
      <CollapsibleSection title="Spending by Category" subtitle="Click a category to see its transactions">
        <div className="space-y-2">
          {categories.filter((c: any) => c.spent > 0).map((c: any) => (
            <button
              key={c.category}
              onClick={() => onCategoryClick(c.category)}
              className={`w-full flex justify-between items-center text-sm px-3 py-2 rounded-lg transition-colors ${activeDrill === c.category ? 'bg-primary-container/40 border border-primary' : 'hover:bg-surface-container border border-transparent'}`}
            >
              <span className="text-content">{c.icon} {c.category}</span>
              <span className="text-content-variant font-mono">${c.spent.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}

function BudgetAnalysis({ analysis, onCategoryClick, onBucketClick, activeDrill }: any) {
  const { overall, buckets, categories, alerts } = analysis

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="bg-danger/10 border border-danger/40 rounded-xl p-4">
          <p className="text-danger font-medium text-sm mb-2">⚠ Over Budget</p>
          {alerts.map((a: string, i: number) => (
            <p key={i} className="text-danger text-xs">{a}</p>
          ))}
        </div>
      )}

      <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="text-lg font-semibold text-content">Overall</h2>
          <span className="text-sm text-content-variant">
            ${overall.spent.toLocaleString('en-US', { maximumFractionDigits: 0 })} of ${overall.budget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
        <ProgressBar pct={overall.pct} over={overall.spent > overall.budget} />
        <p className="text-xs text-content-variant mt-2">
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
              className={`text-left bg-surface-lowest border rounded-xl p-5 transition-colors ${active ? 'border-primary' : 'border-outline-variant/40 hover:border-outline-variant'}`}
            >
              <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-content-variant mb-3">{meta.desc}</p>
              <ProgressBar pct={b.pct} over={b.over} barColor={meta.bar} />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-content-variant">${b.spent.toFixed(0)} spent</span>
                <span className="text-content-variant">${b.budget.toFixed(0)} budget</span>
              </div>
            </button>
          )
        })}
      </div>

      <CollapsibleSection title="By Category" subtitle="Click a category to see its transactions">
        <div className="space-y-4">
          {categories.filter((c: any) => c.budget > 0 || c.spent > 0).map((c: any) => (
            <button
              key={c.category}
              onClick={() => onCategoryClick(c.category)}
              className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${activeDrill === c.category ? 'bg-primary-container/40 border border-primary' : 'hover:bg-surface-container border border-transparent'}`}
            >
              <div className="flex justify-between text-sm mb-1">
                <span className="text-content">{c.icon} {c.category}</span>
                <span className={c.over ? 'text-danger' : 'text-content-variant'}>
                  ${c.spent.toFixed(0)} / ${c.budget.toFixed(0)}
                </span>
              </div>
              <ProgressBar pct={c.pct} over={c.over} thin />
            </button>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}

function BudgetEditor({ suggestion, categories, allocations, setAllocations, onSave, onCancel }: any) {
  const total = Object.values(allocations).reduce((s: number, v: any) => s + (+v || 0), 0)

  return (
    <div className="bg-surface-lowest border border-primary/40 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-content">Set Your Budget</h2>
          <p className="text-xs text-content-variant">Suggested from your last {suggestion.months_analyzed} months. Adjust as needed.</p>
        </div>
        <span className="text-lg font-bold text-primary">${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo</span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {categories.map((cat: any) => {
          const sugg = suggestion.categories.find((s: any) => s.category === cat.name)
          return (
            <div key={cat.id} className="flex items-center justify-between gap-4">
              <span className="text-sm text-content flex-1">{cat.icon} {cat.name}</span>
              {sugg && <span className="text-xs text-content-variant">avg ${sugg.avg}</span>}
              <div className="flex items-center gap-1">
                <span className="text-content-variant text-sm">$</span>
                <input
                  type="number"
                  value={allocations[cat.id] || 0}
                  onChange={e => setAllocations({ ...allocations, [cat.id]: +e.target.value })}
                  className="bg-surface-container border border-outline-variant/50 rounded px-2 py-1 text-content text-sm w-24 text-right"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="bg-primary hover:bg-primary-dim text-content px-6 py-2 rounded-lg text-sm">Save Budget</button>
        <button onClick={onCancel} className="bg-surface-high hover:bg-gray-600 text-content px-6 py-2 rounded-lg text-sm">Cancel</button>
      </div>
    </div>
  )
}

function ProgressBar({ pct, over, barColor = 'bg-primary', thin = false }: { pct: number; over?: boolean; barColor?: string; thin?: boolean }) {
  const width = Math.min(pct, 100)
  const color = over ? 'bg-danger' : barColor
  return (
    <div className={`w-full bg-surface-container rounded-full ${thin ? 'h-1.5' : 'h-3'}`}>
      <div className={`${color} ${thin ? 'h-1.5' : 'h-3'} rounded-full transition-all`} style={{ width: `${width}%` }} />
    </div>
  )
}
