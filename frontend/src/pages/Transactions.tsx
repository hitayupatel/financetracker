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
  const [revalRunning, setRevalRunning] = useState(false)
  const [revalStatus, setRevalStatus] = useState<any>(null)

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
      }
    }, 2000)
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">Transactions</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <input
          placeholder="Search descriptions..."
          value={filter.search}
          onChange={e => setFilter({ ...filter, search: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm flex-1"
        />
        <select
          value={filter.type}
          onChange={e => setFilter({ ...filter, type: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
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
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
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
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          🔄 Re-evaluate Uncategorized
        </button>
        <button
          onClick={() => startReevaluate('all')}
          disabled={revalRunning}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          🔄 Re-evaluate All
        </button>
        {revalRunning && revalStatus && (
          <span className="text-indigo-400 text-sm self-center">
            {revalStatus.progress} / {revalStatus.total} — {revalStatus.updated} categorized
          </span>
        )}
      </div>

      <p className="text-sm text-gray-400 mb-4">
        {transactions.length} transactions | Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Description</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Category</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Type</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Amount</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                editingId === txn.id ? (
                  <tr key={txn.id} className="border-t border-gray-800 bg-gray-800/50">
                    <td className="px-4 py-2"><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs w-full" /></td>
                    <td className="px-4 py-2"><input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs w-full" /></td>
                    <td className="px-4 py-2">
                      <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs w-full">
                        <option value="">None</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select value={editForm.transaction_type} onChange={e => setEditForm({ ...editForm, transaction_type: e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                        <option value="payment">Payment</option>
                        <option value="refund">Refund</option>
                        <option value="investment">Investment</option>
                        <option value="savings">Savings</option>
                      </select>
                    </td>
                    <td className="px-4 py-2"><input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: +e.target.value })} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-xs w-24 text-right" /></td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={saveEdit} className="text-green-400 hover:text-green-300 mr-2"><Check size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white"><X size={16} /></button>
                    </td>
                  </tr>
                ) : (
                  <tr key={txn.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-300">{txn.date}</td>
                    <td className="px-4 py-3 text-gray-100">{txn.description || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{getCategoryName(txn.category_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        txn.transaction_type === 'income' ? 'bg-green-900/50 text-green-400' :
                        txn.transaction_type === 'expense' ? 'bg-red-900/50 text-red-400' :
                        'bg-blue-900/50 text-blue-400'
                      }`}>{txn.transaction_type}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-100">${txn.amount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(txn)} className="text-gray-400 hover:text-indigo-400 mr-2"><Pencil size={14} /></button>
                      <button onClick={() => deleteTransaction(txn.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
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
