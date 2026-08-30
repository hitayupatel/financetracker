import { useEffect, useState } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import api from '../api/client'

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

  const getCategoryName = (id: number | null) => {
    if (!id) return '—'
    const cat = categories.find(c => c.id === id)
    return cat ? `${cat.icon} ${cat.name}` : '—'
  }

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
    // Update local state without full reload
    setTransactions(prev => prev.map(t =>
      t.id === txnId ? { ...t, category_id: categoryId === '' ? null : +categoryId } : t
    ))
  }

  const startReevaluate = async (scope: string) => {
    setRevalRunning(true)
    await api.post(`/jobs/recategorize?scope=${scope}`)
    // Poll status
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
    <div>
      <h1 className="text-2xl font-bold text-content mb-4">Transactions</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          placeholder="Search descriptions..."
          value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-content text-sm flex-1"
        />
        <select
          value={filter.type}
          onChange={e => setFilter({ ...filter, type: e.target.value })}
          className="bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-content text-sm"
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
          className="bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-content text-sm"
        >
          <option value="">All Accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Re-evaluate */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => startReevaluate('uncategorized')}
          disabled={revalRunning}
          className="bg-primary hover:bg-primary-dim disabled:opacity-50 text-content px-4 py-2 rounded-lg text-sm"
        >
          🔄 Re-evaluate Uncategorized
        </button>
        <button
          onClick={() => startReevaluate('all')}
          disabled={revalRunning}
          className="bg-surface-high hover:bg-gray-600 disabled:opacity-50 text-content px-4 py-2 rounded-lg text-sm"
        >
          🔄 Re-evaluate All
        </button>
        {revalRunning && revalStatus && (
          <span className="text-primary text-sm self-center">
            {revalStatus.progress} / {revalStatus.total} — {revalStatus.updated} categorized
          </span>
        )}
        <button
          onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory() }}
          className="bg-surface-container hover:bg-surface-high text-content-variant px-4 py-2 rounded-lg text-sm ml-auto"
        >
          📜 Run History
        </button>
      </div>

      {/* Run history */}
      {showHistory && (
        <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-4 mb-4">
          <h3 className="text-sm font-semibold text-content mb-3">Re-evaluation History</h3>
          {history.length === 0 ? (
            <p className="text-xs text-content-variant">No runs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-content-variant">
                <tr>
                  <th className="text-left py-1">When</th>
                  <th className="text-left py-1">Scope</th>
                  <th className="text-right py-1">Total</th>
                  <th className="text-right py-1">Categorized</th>
                  <th className="text-right py-1">Failed</th>
                  <th className="text-left py-1 pl-3">Model</th>
                </tr>
              </thead>
              <tbody>
                {history.map((run: any) => (
                  <tr key={run.id} className="border-t border-outline-variant/40 text-content-variant">
                    <td className="py-1.5">{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
                    <td className="py-1.5">{run.scope || run.source}</td>
                    <td className="py-1.5 text-right">{run.total}</td>
                    <td className="py-1.5 text-right text-positive">{run.updated}</td>
                    <td className="py-1.5 text-right text-tertiary">{run.failed}</td>
                    <td className="py-1.5 pl-3 text-content-variant">{run.model || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-sm text-content-variant mb-4">
        {transactions.length} transactions | Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>

      {loading ? (
        <p className="text-content-variant">Loading...</p>
      ) : (
        <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr>
                <th className="text-left px-4 py-3 text-content-variant font-medium">Date</th>
                <th className="text-left px-4 py-3 text-content-variant font-medium">Description</th>
                <th className="text-left px-4 py-3 text-content-variant font-medium">Category</th>
                <th className="text-left px-4 py-3 text-content-variant font-medium">Type</th>
                <th className="text-right px-4 py-3 text-content-variant font-medium">Amount</th>
                <th className="text-right px-4 py-3 text-content-variant font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                editingId === txn.id ? (
                  <tr key={txn.id} className="border-t border-outline-variant/40 bg-surface-container/50">
                    <td className="px-4 py-2"><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="bg-surface-high border border-outline-variant rounded px-2 py-1 text-content text-xs w-full" /></td>
                    <td className="px-4 py-2"><input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="bg-surface-high border border-outline-variant rounded px-2 py-1 text-content text-xs w-full" /></td>
                    <td className="px-4 py-2">
                      <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })} className="bg-surface-high border border-outline-variant rounded px-2 py-1 text-content text-xs w-full">
                        <option value="">None</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select value={editForm.transaction_type} onChange={e => setEditForm({ ...editForm, transaction_type: e.target.value })} className="bg-surface-high border border-outline-variant rounded px-2 py-1 text-content text-xs">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="payment">Payment</option>
                        <option value="refund">Refund</option>
                        <option value="investment">Investment</option>
                        <option value="savings">Savings</option>
                      </select>
                    </td>
                    <td className="px-4 py-2"><input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: +e.target.value })} className="bg-surface-high border border-outline-variant rounded px-2 py-1 text-content text-xs w-24 text-right" /></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={saveEdit} className="text-positive hover:text-positive mr-2"><Check size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="text-content-variant hover:text-content"><X size={16} /></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={txn.id} className="border-t border-outline-variant/40 hover:bg-surface-container/50">
                    <td className="px-4 py-3 text-content-variant">{txn.date}</td>
                    <td className="px-4 py-3 text-content">{txn.description || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={txn.category_id || ''}
                        onChange={e => quickChangeCategory(txn.id, e.target.value)}
                        className={`bg-transparent border border-outline-variant/50 hover:border-primary rounded px-2 py-1 text-xs cursor-pointer ${txn.category_id ? 'text-content-variant' : 'text-tertiary'}`}
                      >
                        <option value="">— Uncategorized —</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        txn.transaction_type === 'income' ? 'bg-positive/15 text-positive' :
                        txn.transaction_type === 'expense' ? 'bg-danger/15 text-danger' :
                        'bg-blue-900/50 text-primary'
                      }`}>{txn.transaction_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-content">${txn.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(txn)} className="text-content-variant hover:text-primary mr-2"><Pencil size={14} /></button>
                      <button onClick={() => deleteTransaction(txn.id)} className="text-content-variant hover:text-danger"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
