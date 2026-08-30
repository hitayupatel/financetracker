import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import api from '../api/client'

// Tonal pill styling per transaction type
const TYPE_PILL: Record<string, string> = {
  income: 'bg-secondary-container text-secondary-on-container',
  expense: 'bg-surface-container text-content-variant',
  payment: 'bg-primary-fixed text-primary-on-fixed',
  refund: 'bg-secondary-container text-secondary-on-container',
  investment: 'bg-tertiary-fixed text-tertiary-on-fixed',
  savings: 'bg-primary-fixed text-primary-on-fixed',
  transfer: 'bg-surface-container text-content-variant',
}

const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [filter, setFilter] = useState({ type: '', account_id: '', search: '' })

  const load = () => {
    setLoading(true)
    const params: any = { limit: 200 }
    if (filter.type) params.transaction_type = filter.type
    if (filter.account_id) params.account_id = filter.account_id
    if (filter.search) params.search = filter.search

    Promise.all([
      api.get('/transactions', { params }),
      api.get('/transactions/categories'),
      api.get('/accounts'),
    ]).then(([txnRes, catRes, accRes]) => {
      setTransactions(txnRes.data)
      setCategories(catRes.data)
      setAccounts(accRes.data)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [filter])

  const getCategory = (id: number | null) => (id ? categories.find(c => c.id === id) : null)
  const getAccount = (id: number | null) => (id ? accounts.find(a => a.id === id) : null)

  const startEdit = (txn: any) => {
    setEditingId(txn.id)
    setEditForm({
      date: txn.date,
      amount: txn.amount,
      transaction_type: txn.transaction_type,
      description: txn.description || '',
      category_id: txn.category_id || '',
      notes: txn.notes || '',
    })
  }

  const saveEdit = async () => {
    const data: any = { ...editForm }
    if (data.category_id === '') data.category_id = null
    else data.category_id = +data.category_id
    await api.put(`/transactions/${editingId}`, data)
    setEditingId(null)
    load()
  }

  const deleteTransaction = async (id: number) => {
    if (!confirm('Delete this transaction?')) return
    await api.delete(`/transactions/${id}`)
    load()
  }

  // Re-evaluate
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [revalRunning, setRevalRunning] = useState(false)
  const [revalStatus, setRevalStatus] = useState<any>(null)

  const loadHistory = () => {
    api.get('/jobs/history').then(r => setHistory(r.data))
  }

  const quickChangeCategory = async (txnId: number, categoryId: string) => {
    await api.put(`/transactions/${txnId}`, {
      category_id: categoryId === '' ? null : +categoryId,
    })
    setTransactions(prev => prev.map(t =>
      t.id === txnId ? { ...t, category_id: categoryId === '' ? null : +categoryId } : t
    ))
  }

  const startReevaluate = async (scope: string) => {
    setRevalRunning(true)
    await api.post(`/jobs/recategorize?scope=${scope}`)
    const poll = setInterval(async () => {
      const res = await api.get('/jobs/recategorize/status')
      setRevalStatus(res.data)
      if (res.data.done) {
        clearInterval(poll)
        setRevalRunning(false)
        load()
        loadHistory()
      }
    }, 2000)
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="flex flex-col gap-gutter">
      {/* Page header + filters */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-content">Transactions</h1>
          <p className="text-body-md text-content-variant mt-1">Review and manage your financial activities.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center bg-surface-lowest border border-outline-variant rounded-lg px-3 focus-within:ring-2 focus-within:ring-primary transition-all">
            <Icon name="search" className="text-content-variant mr-2" size={18} />
            <input
              placeholder="Search descriptions…"
              value={filter.search}
              onChange={e => setFilter({ ...filter, search: e.target.value })}
              className="bg-transparent outline-none text-sm py-2 text-content placeholder-content-variant w-48"
            />
          </div>
          <select
            value={filter.type}
            onChange={e => setFilter({ ...filter, type: e.target.value })}
            className="input"
          >
            <option value="">All Types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="payment">Payment</option>
            <option value="refund">Refund</option>
            <option value="investment">Investment</option>
            <option value="savings">Savings</option>
          </select>
          <select
            value={filter.account_id}
            onChange={e => setFilter({ ...filter, account_id: e.target.value })}
            className="input"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Re-evaluate toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <button onClick={() => startReevaluate('uncategorized')} disabled={revalRunning} className="btn-primary disabled:opacity-50">
          <Icon name="auto_fix_high" size={18} /> Re-evaluate Uncategorized
        </button>
        <button onClick={() => startReevaluate('all')} disabled={revalRunning} className="btn-secondary disabled:opacity-50">
          <Icon name="refresh" size={18} /> Re-evaluate All
        </button>
        {revalRunning && revalStatus && (
          <span className="text-primary text-sm self-center font-medium">
            {revalStatus.progress} / {revalStatus.total} — {revalStatus.updated} categorized
          </span>
        )}
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory() }}
          className="btn-secondary ml-auto"
        >
          <Icon name="history" size={18} /> Run History
        </button>
      </div>

      {/* Run history */}
      {showHistory && (
        <div className="card p-6">
          <h3 className="text-headline-md text-content mb-3">Re-evaluation History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-content-variant">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/50">
                    <th className="text-left py-2 label-caps text-content-variant">When</th>
                    <th className="text-left py-2 label-caps text-content-variant">Scope</th>
                    <th className="text-right py-2 label-caps text-content-variant">Total</th>
                    <th className="text-right py-2 label-caps text-content-variant">Categorized</th>
                    <th className="text-right py-2 label-caps text-content-variant">Failed</th>
                    <th className="text-left py-2 pl-3 label-caps text-content-variant">Model</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {history.map((run: any) => (
                    <tr key={run.id} className="text-content-variant">
                      <td className="py-2 font-data text-xs">{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
                      <td className="py-2">{run.scope || run.source}</td>
                      <td className="py-2 text-right font-data">{run.total}</td>
                      <td className="py-2 text-right font-data text-positive">{run.updated}</td>
                      <td className="py-2 text-right font-data text-tertiary">{run.failed}</td>
                      <td className="py-2 pl-3 font-data text-xs">{run.model || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary line */}
      <p className="text-sm text-content-variant -mb-2">
        <span className="font-data text-content">{transactions.length}</span> transactions · Total{' '}
        <span className="font-data text-content">${fmt2(total)}</span>
      </p>

      {/* Data table */}
      {loading ? (
        <p className="text-content-variant">Loading…</p>
      ) : (
        <div className="card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-low border-b border-outline-variant/50">
                  <th className="px-6 py-4 label-caps text-primary">Date</th>
                  <th className="px-6 py-4 label-caps text-primary">Merchant / Description</th>
                  <th className="px-6 py-4 label-caps text-primary">Category</th>
                  <th className="px-6 py-4 label-caps text-primary">Account</th>
                  <th className="px-6 py-4 label-caps text-primary text-center">Type</th>
                  <th className="px-6 py-4 label-caps text-primary text-right">Amount</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {transactions.map(txn => (
                  editingId === txn.id ? (
                    <tr key={txn.id} className="bg-surface-container/50">
                      <td className="px-6 py-3"><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="input w-full !py-1.5 text-xs" /></td>
                      <td className="px-6 py-3"><input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="input w-full !py-1.5 text-xs" /></td>
                      <td className="px-6 py-3">
                        <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })} className="input w-full !py-1.5 text-xs">
                          <option value="">None</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-3 text-content-variant text-xs">{getAccount(txn.account_id)?.name || '—'}</td>
                      <td className="px-6 py-3">
                        <select value={editForm.transaction_type} onChange={e => setEditForm({ ...editForm, transaction_type: e.target.value })} className="input w-full !py-1.5 text-xs">
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                          <option value="payment">Payment</option>
                          <option value="refund">Refund</option>
                          <option value="investment">Investment</option>
                          <option value="savings">Savings</option>
                        </select>
                      </td>
                      <td className="px-6 py-3"><input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: +e.target.value })} className="input w-24 !py-1.5 text-xs text-right font-data" /></td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button onClick={saveEdit} className="p-1.5 rounded-lg text-positive hover:bg-surface-high"><Icon name="check" size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-content-variant hover:bg-surface-high"><Icon name="close" size={18} /></button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={txn.id} className="hover:bg-surface-low transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-data text-content">{txn.date}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-content-variant shrink-0 text-lg">
                            {getCategory(txn.category_id)?.icon
                              ? <span>{getCategory(txn.category_id)?.icon}</span>
                              : <Icon name="storefront" size={20} />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-body-md font-medium text-content truncate max-w-xs">{txn.description || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={txn.category_id || ''}
                          onChange={e => quickChangeCategory(txn.id, e.target.value)}
                          className={`bg-transparent border border-outline-variant/50 hover:border-primary rounded-full px-3 py-1 text-xs cursor-pointer transition-colors ${txn.category_id ? 'text-content' : 'text-tertiary'}`}
                        >
                          <option value="">— Uncategorized —</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-body-sm text-content">{getAccount(txn.account_id)?.name || '—'}</div>
                        {getAccount(txn.account_id)?.institution && (
                          <div className="font-data text-xs text-content-variant">{getAccount(txn.account_id)?.institution}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`chip label-caps ${TYPE_PILL[txn.transaction_type] || 'bg-surface-container text-content-variant'}`}>
                          {txn.transaction_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className={`font-data font-semibold ${
                          txn.transaction_type === 'income' || txn.transaction_type === 'refund' ? 'text-positive' : 'text-content'
                        }`}>
                          {txn.transaction_type === 'income' || txn.transaction_type === 'refund' ? '+' : ''}${fmt2(txn.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(txn)} className="p-1.5 rounded-lg text-content-variant hover:text-primary hover:bg-surface-high"><Icon name="edit" size={16} /></button>
                        <button onClick={() => deleteTransaction(txn.id)} className="p-1.5 rounded-lg text-content-variant hover:text-danger hover:bg-surface-high"><Icon name="delete" size={16} /></button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
