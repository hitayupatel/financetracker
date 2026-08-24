import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Accounts() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [netWorth, setNetWorth] = useState<any>(null)
  const [showAdd, setShowAdd] = useState(false)
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Accounts</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Add Account
        </button>
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

      {/* Add Form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Add Account</h2>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Account Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
              <option value="bank">Bank</option>
              <option value="credit_card">Credit Card</option>
              <option value="wallet">Wallet</option>
              <option value="investment">Investment</option>
            </select>
            <input placeholder="Institution" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            <input type="number" placeholder="Balance" value={form.balance} onChange={e => setForm({ ...form, balance: +e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
            <input type="number" placeholder="Credit Limit" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: +e.target.value })} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
          </div>
          <button onClick={handleAdd} className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium">Save</button>
        </div>
      )}

      {/* Account List */}
      <div className="space-y-3">
        {accounts.map(acc => (
          <div key={acc.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-white font-medium">{acc.name}</p>
              <p className="text-xs text-gray-500">{acc.institution || acc.account_type.replace('_', ' ')}</p>
            </div>
            <p className={`font-bold ${acc.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
