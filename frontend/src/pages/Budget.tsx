import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import api from '../api/client'
import TransactionList from '../components/TransactionList'

function CollapsibleSection({ title, subtitle, defaultOpen = true, children }: { title: string; subtitle?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card overflow-hidden !p-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-low transition-colors"
      >
        <div className="text-left">
          <h2 className="text-headline-md text-content">{title}</h2>
          {subtitle && <p className="text-body-sm text-content-variant mt-0.5">{subtitle}</p>}
        </div>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-content-variant" size={22} />
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

const BUCKET_META: Record<string, { label: string; color: string; bar: string; icon: string; desc: string }> = {
  needs: { label: 'Needs', color: 'text-primary', bar: 'bg-primary', icon: 'home', desc: 'Rent, groceries, utilities, transport, insurance' },
  wants: { label: 'Wants', color: 'text-tertiary', bar: 'bg-tertiary', icon: 'shopping_bag', desc: 'Dining, shopping, entertainment, subscriptions' },
  savings: { label: 'Savings & Investments', color: 'text-positive', bar: 'bg-positive', icon: 'savings', desc: 'Emergency fund, stocks, ETFs, retirement' },
}

const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
    const bucketCats = (analysis?.categories || []).filter((c: any) => c.bucket === bucketName)
    const catIds = bucketCats
      .map((bc: any) => categories.find((c: any) => c.name === bc.category)?.id)
      .filter(Boolean)
    if (catIds.length === 0) return

    const { startDate, endDate } = dateRange()
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
    <div className="flex flex-col gap-gutter">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-lg text-content">Budget</h1>
            {analysis && (
              hasBudget ? (
                <span className="chip label-caps bg-secondary-container text-secondary-on-container gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive" /> Budget set
                </span>
              ) : (
                <span className="chip label-caps bg-surface-container text-content-variant gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline" /> No budget
                </span>
              )
            )}
          </div>
          <p className="text-body-lg text-content-variant mt-1">Track and control your monthly spending.</p>
        </div>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(e.target.value)} className="input">
            {months.map(m => {
              const budgeted = budgetedMonths.includes(m)
              return (
                <option key={m} value={m}>
                  {budgeted ? '● ' : '○ '}{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                </option>
              )
            })}
          </select>
          <button onClick={startSetup} className="btn-primary">
            <Icon name={hasBudget ? 'edit' : 'add'} size={18} />
            {hasBudget ? 'Edit Budget' : 'Set Up Budget'}
          </button>
        </div>
      </div>

      {/* Legend for indicators */}
      <div className="flex gap-4 text-xs text-content-variant -mt-2">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-positive" /> budget configured</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-outline" /> no budget (spending only)</span>
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
            <TransactionList
              transactions={drillTransactions}
              title={drillCategory}
              onClose={() => { setDrillCategory(null); setDrillTransactions([]) }}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Circular budget-health ring (SVG). */
function HealthRing({ pct, over }: { pct: number; over: boolean }) {
  const r = 45
  const circ = 2 * Math.PI * r
  const clamped = Math.min(Math.max(pct, 0), 100)
  const offset = circ - (clamped / 100) * circ
  const score = Math.max(0, Math.round(100 - pct))
  const stroke = over ? '#a83836' : clamped > 85 ? '#6b5680' : '#2e7d5b'
  return (
    <div className="relative w-44 h-44 flex items-center justify-center">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#ecedf6" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-700" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-display-lg font-data" style={{ color: stroke }}>{score}</span>
        <span className="label-caps text-content-variant">Score</span>
      </div>
    </div>
  )
}

function NoBudgetView({ analysis, onCategoryClick, onBucketClick, activeDrill, onSetup }: any) {
  const { overall, buckets, categories } = analysis

  return (
    <div className="flex flex-col gap-gutter">
      <div className="rounded-lg bg-tertiary-fixed/40 border border-tertiary/30 p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-tertiary-fixed text-tertiary-on-fixed flex items-center justify-center">
            <Icon name="lightbulb" />
          </div>
          <div>
            <p className="text-content font-semibold">No budget set for this month</p>
            <p className="text-content-variant text-sm">Here's your actual spending. Set a budget to track against it.</p>
          </div>
        </div>
        <button onClick={onSetup} className="btn-primary whitespace-nowrap"><Icon name="add" size={18} /> Set Up Budget</button>
      </div>

      {/* Bento — spending total (4col) + bucket cards (8col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-4 card p-6 flex flex-col justify-center">
          <p className="label-caps text-content-variant">Total Spending</p>
          <p className="text-display-lg font-data text-content mt-1">${fmt0(overall.spent)}</p>
          <p className="text-body-sm text-content-variant mt-1">this month, across all categories</p>
        </div>
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {buckets.map((b: any) => {
            const meta = BUCKET_META[b.bucket]
            const active = activeDrill === b.bucket.charAt(0).toUpperCase() + b.bucket.slice(1)
            return (
              <button
                key={b.bucket}
                onClick={() => onBucketClick(b.bucket)}
                className={`text-left card p-5 transition-all ${active ? '!border-primary ring-1 ring-primary' : 'hover:shadow-level-2'}`}
              >
                <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center text-content-variant mb-3">
                  <Icon name={meta.icon} />
                </div>
                <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
                <p className="text-xs text-content-variant mb-3">{meta.desc}</p>
                <p className="text-headline-md font-data text-content">${fmt0(b.spent)}</p>
                <p className="text-xs text-content-variant">spent · click to view</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Category spending — clickable, collapsible */}
      <CollapsibleSection title="Spending by Category" subtitle="Click a category to see its transactions">
        <div className="space-y-1">
          {categories.filter((c: any) => c.spent > 0).map((c: any) => (
            <button
              key={c.category}
              onClick={() => onCategoryClick(c.category)}
              className={`w-full flex justify-between items-center text-sm px-3 py-2.5 rounded-lg transition-colors ${activeDrill === c.category ? 'bg-surface-container' : 'hover:bg-surface-low'}`}
            >
              <span className="flex items-center gap-2 text-content"><span className="text-lg">{c.icon}</span> {c.category}</span>
              <span className="text-content font-data">${fmt2(c.spent)}</span>
            </button>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  )
}

function BudgetAnalysis({ analysis, onCategoryClick, onBucketClick, activeDrill }: any) {
  const { overall, buckets, categories, alerts } = analysis
  const spentPct = overall.budget ? (overall.spent / overall.budget) * 100 : 0
  const over = overall.spent > overall.budget

  return (
    <div className="flex flex-col gap-gutter">
      {alerts.length > 0 && (
        <div className="rounded-lg bg-danger-container/30 border border-danger-container p-4">
          <p className="text-danger-dim font-semibold text-sm mb-2 flex items-center gap-2"><Icon name="warning" size={18} /> Over Budget</p>
          {alerts.map((a: string, i: number) => (
            <p key={i} className="text-danger-dim text-xs">{a}</p>
          ))}
        </div>
      )}

      {/* Bento — health ring + monthly goal (4col) | category bars (8col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left column: health + overall */}
        <div className="lg:col-span-4 flex flex-col gap-gutter">
          <div className="card p-6 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-secondary-container" />
            <h2 className="text-headline-md text-content w-full text-left mb-2">Budget Health</h2>
            <HealthRing pct={spentPct} over={over} />
            <div className="w-full flex justify-between items-center px-4 mt-4">
              <div className="text-center flex-1">
                <div className="label-caps text-content-variant">Spent</div>
                <div className="font-data text-content mt-0.5">${fmt0(overall.spent)}</div>
              </div>
              <div className="h-8 w-px bg-outline-variant/60" />
              <div className="text-center flex-1">
                <div className="label-caps text-content-variant">{overall.remaining >= 0 ? 'Remaining' : 'Over'}</div>
                <div className={`font-data mt-0.5 ${overall.remaining >= 0 ? 'text-positive' : 'text-danger'}`}>
                  ${fmt0(Math.abs(overall.remaining))}
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-headline-md text-content mb-3">Monthly Budget</h2>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-display-lg font-data text-content">${fmt0(overall.budget)}</span>
              <span className="text-body-md text-content-variant">/ month</span>
            </div>
            <ProgressBar pct={overall.pct} over={over} />
            <p className="text-body-sm text-content-variant mt-2">
              {over
                ? `$${fmt0(Math.abs(overall.remaining))} over your budget this month.`
                : `$${fmt0(overall.remaining)} left to spend this month.`}
            </p>
          </div>
        </div>

        {/* Right column: category spending bars */}
        <div className="lg:col-span-8 card p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-headline-md text-content">Category Spending</h2>
            <span className="chip label-caps bg-secondary-container text-secondary-on-container">This Month</span>
          </div>
          <div className="space-y-5">
            {categories.filter((c: any) => c.budget > 0 || c.spent > 0).map((c: any) => (
              <button
                key={c.category}
                onClick={() => onCategoryClick(c.category)}
                className={`w-full text-left rounded-lg p-2 -m-2 transition-colors ${activeDrill === c.category ? 'bg-surface-low' : 'hover:bg-surface-low'}`}
              >
                <div className="flex justify-between items-end mb-1.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center text-lg shrink-0">{c.icon}</div>
                    <div>
                      <div className="text-body-md font-semibold text-content">{c.category}</div>
                      <div className="text-body-sm text-content-variant">{c.bucket ? BUCKET_META[c.bucket]?.label : ''}</div>
                    </div>
                  </div>
                  <div className={`font-data ${c.over ? 'text-danger' : 'text-content'}`}>
                    ${fmt0(c.spent)} <span className="text-content-variant">/ ${fmt0(c.budget)}</span>
                  </div>
                </div>
                <ProgressBar pct={c.pct} over={c.over} />
                <div className={`mt-1 text-right text-body-sm ${c.over ? 'text-danger font-semibold' : 'text-content-variant'}`}>
                  {c.over ? `Over budget by $${fmt0(c.spent - c.budget)}` : `${Math.round(c.pct)}% used`}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function BudgetEditor({ suggestion, categories, allocations, setAllocations, onSave, onCancel }: any) {
  const total = Object.values(allocations).reduce((s: number, v: any) => s + (+v || 0), 0)

  return (
    <div className="card p-6 !border-primary/40">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-headline-md text-content">Set Your Budget</h2>
          <p className="text-body-sm text-content-variant">Suggested from your last {suggestion.months_analyzed} months. Adjust as needed.</p>
        </div>
        <span className="text-headline-md font-data text-primary">${fmt0(total)}/mo</span>
      </div>

      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
        {categories.map((cat: any) => {
          const sugg = suggestion.categories.find((s: any) => s.category === cat.name)
          return (
            <div key={cat.id} className="flex items-center justify-between gap-4">
              <span className="text-sm text-content flex-1 flex items-center gap-2"><span className="text-lg">{cat.icon}</span> {cat.name}</span>
              {sugg && <span className="text-xs text-content-variant font-data">avg ${sugg.avg}</span>}
              <div className="flex items-center gap-1">
                <span className="text-content-variant text-sm">$</span>
                <input
                  type="number"
                  value={allocations[cat.id] || 0}
                  onChange={e => setAllocations({ ...allocations, [cat.id]: +e.target.value })}
                  className="input w-24 text-right font-data !py-1.5"
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={onSave} className="btn-primary"><Icon name="check" size={18} /> Save Budget</button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

function ProgressBar({ pct, over, barColor = 'bg-primary', thin = false }: { pct: number; over?: boolean; barColor?: string; thin?: boolean }) {
  const width = Math.min(pct, 100)
  const color = over ? 'bg-danger' : barColor
  return (
    <div className={`w-full bg-surface-low rounded-full overflow-hidden border border-outline-variant/40 ${thin ? 'h-1.5' : 'h-3'}`}>
      <div className={`${color} ${thin ? 'h-1.5' : 'h-3'} rounded-full transition-all duration-500`} style={{ width: `${width}%` }} />
    </div>
  )
}
