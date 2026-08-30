import { useEffect, useState } from 'react'
import api from '../api/client'

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

  const [year, mon] = month.split('-').map(Number)

  const loadAnalysis = () => {
    api.get(`/budget/${year}/${mon}/analysis`).then(r => setAnalysis(r.data))
  }

  useEffect(() => {
    loadAnalysis()
    api.get('/transactions/categories').then(r => setCategories(r.data.filter((c: any) => ['expense', 'investment', 'savings'].includes(c.category_type))))
  }, [month])

  const startSetup = async () => {
    const [sugg, existing] = await Promise.all([
      api.get('/budget/suggest?months_back=3'),
      api.get(`/budget/${year}/${mon}`),
    ])
    setSuggestion(sugg.data)
    // Prefill with existing budget or suggestions
    const alloc: Record<number, number> = {}
    if (existing.data.exists) {
      existing.data.categories.forEach((c: any) => { alloc[c.category_id] = c.amount })
    } else {
      // map suggestions by category name -> id
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
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Budget</h1>
        <div className="flex gap-3">
          <select value={month} onChange={e => setMonth(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
            {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</option>)}
          </select>
          <button onClick={startSetup} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm">
            {analysis?.has_budget ? 'Edit Budget' : 'Set Up Budget'}
          </button>
        </div>
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

      {/* Analysis view */}
      {!editing && analysis && (
        analysis.has_budget ? (
          <BudgetAnalysis analysis={analysis} />
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <p className="text-4xl mb-4">💰</p>
            <h2 className="text-lg font-semibold text-white mb-2">No budget set for this month</h2>
            <p className="text-gray-400 text-sm mb-6">We'll suggest one based on your last 3 months of spending.</p>
            <button onClick={startSetup} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm">
              Set Up Budget
            </button>
          </div>
        )
      )}
    </div>
  )
}

function BudgetAnalysis({ analysis }: { analysis: any }) {
  const { overall, buckets, categories, alerts } = analysis

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
          <p className="text-red-400 font-medium text-sm mb-2">⚠ Over Budget</p>
          {alerts.map((a: string, i: number) => (
            <p key={i} className="text-red-300 text-xs">{a}</p>
          ))}
        </div>
      )}

      {/* Overall */}
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

      {/* Buckets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {buckets.map((b: any) => {
          const meta = BUCKET_META[b.bucket]
          return (
            <div key={b.bucket} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className={`font-semibold ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-gray-500 mb-3">{meta.desc}</p>
              <ProgressBar pct={b.pct} over={b.over} barColor={meta.bar} />
              <div className="flex justify-between text-xs mt-2">
                <span className="text-gray-400">${b.spent.toFixed(0)} spent</span>
                <span className="text-gray-500">${b.budget.toFixed(0)} budget</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Category breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">By Category</h2>
        <div className="space-y-4">
          {categories.filter((c: any) => c.budget > 0 || c.spent > 0).map((c: any) => (
            <div key={c.category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-200">{c.icon} {c.category}</span>
                <span className={c.over ? 'text-red-400' : 'text-gray-400'}>
                  ${c.spent.toFixed(0)} / ${c.budget.toFixed(0)}
                </span>
              </div>
              <ProgressBar pct={c.pct} over={c.over} thin />
            </div>
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
