import { useEffect, useState } from 'react'
import { Pencil, Trash2, X, Check } from 'lucide-react'
import api from '../api/client'

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [netWorth, setNetWorth] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', account_type: 'bank', institution: '', balance: 0, credit_limit: 0 })

  const load = () => {
    api.get('/accounts?active_only=false').then(r => setAccounts(r.data))
    api.get('/accounts/net-worth').then(r => setNetWorth(r.data))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    await api.post('/accounts', {
      ...form,
      credit_limit: form.credit_limit > 0 ? form.credit_limit : null,
      institution: form.institution || null,
    })
    setShowAdd(false)
    setForm({ name: '', account_type: 'bank', institution: '', balance: 0, credit_limit: 0 })
    load()
  }

  const startEdit = (acc: any) => {
    setEditingId(acc.id)
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      institution: acc.institution || '',
      balance: acc.balance,
      credit_limit: acc.credit_limit || 0,
    })
  }

  const saveEdit = async () => {
    await api.put(`/accounts/${editingId}`, {
      ...form,
      credit_limit: form.credit_limit > 0 ? form.credit_limit : null,
      institution: form.institution || null,
    })
    setEditingId(null)
    load()
  }

  const deactivate = async (id: number) => {
    if (!confirm('Deactivate this account?')) return
    await api.delete(`/accounts/${id}`)
    load()
  }

  const recalculateAll = async () => {
    for (const acc of accounts) {
      await api.post(`/accounts/${acc.id}/recalculate`)
    }
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Accounts</h1>
        <div className="flex gap-3">
          <button onClick={recalculateAll} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
            🔄 Recalculate
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setEditingId(null) }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Add Account
          </button>
        </div>
      </div>

      {/* Net Worth */}
      {netWorth && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Net Worth</p>
            <p className="text-xl font-bold text-indigo-400 mt-1">${netWorth.net_worth.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Assets</p>
            <p className="text-xl font-bold text-green-400 mt-1">${netWorth.total_assets.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase">Liabilities</p>
            <p className="text-xl font-bold text-red-400 mt-1">${netWorth.total_liabilities.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {(showAdd || editingId) && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">{editingId ? 'Edit Account' : 'Add Account'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Account Name</label>
              <input placeholder="e.g., Chase Checking" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Account Type</label>
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full">
                <option value="bank">Bank</option>
                <option value="credit_card">Credit Card</option>
                <option value="wallet">Wallet</option>
                <option value="investment">Investment</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Institution</label>
              <input placeholder="e.g., Chase, Capital One" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Opening Balance ($)</label>
              <input type="number" placeholder="0.00" value={form.balance} onChange={e => setForm({ ...form, balance: +e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Credit Limit ($) — for credit cards</label>
              <input type="number" placeholder="0.00" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: +e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-full" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={editingId ? saveEdit : handleAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
              {editingId ? 'Save Changes' : 'Add'}
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Account List */}
      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-green-400' : 'bg-red-400'}`} />
                <p className="text-white font-medium">{acc.name}</p>
              </div>
              <p className="text-xs text-gray-500 ml-4">{acc.institution || acc.account_type.replace('_', ' ')}</p>
            </div>
            <div className="flex items-center gap-4">
              <p className={`font-bold font-mono ${acc.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <button onClick={() => startEdit(acc)} className="text-gray-400 hover:text-indigo-400"><Pencil size={14} /></button>
              <button onClick={() => deactivate(acc.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
