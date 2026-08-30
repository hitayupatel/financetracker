import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import api from '../api/client'

const TYPE_META: Record<string, { icon: string; badge: string; accent: string; badgeClass: string }> = {
  bank: { icon: 'account_balance', badge: 'BANK', accent: 'bg-primary-fixed text-primary-on-fixed', badgeClass: 'bg-surface-container text-content-variant' },
  credit_card: { icon: 'credit_card', badge: 'CREDIT', accent: 'bg-danger-container text-danger-on-container', badgeClass: 'bg-surface-container text-content-variant' },
  wallet: { icon: 'wallet', badge: 'WALLET', accent: 'bg-secondary-container text-secondary-on-container', badgeClass: 'bg-surface-container text-content-variant' },
  investment: { icon: 'trending_up', badge: 'INVEST', accent: 'bg-tertiary-fixed text-tertiary-on-fixed', badgeClass: 'bg-surface-container text-content-variant' },
}

const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

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
    setShowAdd(false)
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
    <div className="flex flex-col gap-gutter">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-content">Accounts</h1>
          <p className="text-body-md text-content-variant mt-1">Manage your linked accounts and portfolios.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={recalculateAll} className="btn-secondary">
            <Icon name="refresh" size={18} /> Recalculate
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setEditingId(null) }} className="btn-primary">
            <Icon name="add" size={18} /> Add Account
          </button>
        </div>
      </div>

      {/* Net worth summary */}
      {netWorth && (
        <div className="grid grid-cols-3 gap-gutter">
          <SummaryCard label="Net Worth" value={`$${fmt0(netWorth.net_worth)}`} valueClass="text-primary" icon="account_balance" />
          <SummaryCard label="Assets" value={`$${fmt0(netWorth.total_assets)}`} valueClass="text-positive" icon="trending_up" />
          <SummaryCard label="Liabilities" value={`$${fmt0(netWorth.total_liabilities)}`} valueClass="text-danger" icon="credit_card" />
        </div>
      )}

      {/* Add/Edit form */}
      {(showAdd || editingId) && (
        <div className="card p-6">
          <h2 className="text-headline-md text-content mb-4">{editingId ? 'Edit Account' : 'Add Account'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Account Name">
              <input placeholder="e.g., Chase Checking" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" />
            </Field>
            <Field label="Account Type">
              <select value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })} className="input w-full">
                <option value="bank">Bank</option>
                <option value="credit_card">Credit Card</option>
                <option value="wallet">Wallet</option>
                <option value="investment">Investment</option>
              </select>
            </Field>
            <Field label="Institution">
              <input placeholder="e.g., Chase, Capital One" value={form.institution} onChange={e => setForm({ ...form, institution: e.target.value })} className="input w-full" />
            </Field>
            <Field label="Opening Balance ($)">
              <input type="number" placeholder="0.00" value={form.balance} onChange={e => setForm({ ...form, balance: +e.target.value })} className="input w-full font-data" />
            </Field>
            <Field label="Credit Limit ($) — for credit cards">
              <input type="number" placeholder="0.00" value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: +e.target.value })} className="input w-full font-data" />
            </Field>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={editingId ? saveEdit : handleAdd} className="btn-primary">
              {editingId ? 'Save Changes' : 'Add Account'}
            </button>
            <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Account cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
        {accounts.map(acc => {
          const meta = TYPE_META[acc.account_type] || TYPE_META.bank
          const balanceLabel = acc.account_type === 'credit_card' ? 'CURRENT BALANCE'
            : acc.account_type === 'investment' ? 'PORTFOLIO VALUE' : 'AVAILABLE BALANCE'
          return (
            <div key={acc.id} className={`card p-6 flex flex-col hover:shadow-level-2 transition-shadow group ${!acc.is_active ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${meta.accent}`}>
                    <Icon name={meta.icon} />
                  </div>
                  <div>
                    <h3 className="text-body-lg font-semibold text-content leading-tight">{acc.name}</h3>
                    <p className="font-data text-xs text-content-variant">{acc.institution || acc.account_type.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={`chip label-caps ${meta.badgeClass}`}>{meta.badge}</span>
              </div>

              <div className="mt-auto">
                <p className="label-caps text-content-variant mb-1">{balanceLabel}</p>
                <p className={`text-headline-lg font-data ${acc.balance >= 0 ? 'text-content' : 'text-danger'}`}>
                  ${fmt2(acc.balance)}
                </p>
              </div>

              {/* Actions — revealed on hover */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-outline-variant/30 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className={`flex items-center gap-1 text-xs ${acc.is_active ? 'text-positive' : 'text-danger'}`}>
                  <span className={`w-2 h-2 rounded-full ${acc.is_active ? 'bg-positive' : 'bg-danger'}`} />
                  {acc.is_active ? 'Active' : 'Inactive'}
                </span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => startEdit(acc)} className="p-1.5 rounded-lg text-content-variant hover:text-primary hover:bg-surface-high transition-colors">
                    <Icon name="edit" size={18} />
                  </button>
                  <button onClick={() => deactivate(acc.id)} className="p-1.5 rounded-lg text-content-variant hover:text-danger hover:bg-surface-high transition-colors">
                    <Icon name="delete" size={18} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, valueClass, icon }: { label: string; value: string; valueClass: string; icon: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps text-content-variant">{label}</p>
        <span className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center text-content-variant">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className={`text-headline-md font-data mt-2 ${valueClass}`}>{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-caps text-content-variant block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
