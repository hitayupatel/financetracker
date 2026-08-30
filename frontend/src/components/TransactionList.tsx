import { useState } from 'react'
import Icon from './Icon'

interface Transaction {
  id: number
  date: string
  amount: number
  description: string | null
  transaction_type?: string
  isRefund?: boolean
}

interface Props {
  transactions: Transaction[]
  title?: string
  onClose?: () => void
  showType?: boolean
}

const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TransactionList({ transactions, title, onClose, showType = false }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? transactions.filter(t => (t.description || '').toLowerCase().includes(search.toLowerCase()))
    : transactions

  const total = filtered.reduce((s, t) => s + (t.isRefund ? -t.amount : t.amount), 0)

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {title && <h2 className="text-headline-md text-content">{title} <span className="text-content-variant font-data text-base">({filtered.length})</span></h2>}
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-content-variant hover:text-content hover:bg-surface-high transition-colors">
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative flex items-center bg-surface-lowest border border-outline-variant rounded-lg px-3 mb-4 focus-within:ring-2 focus-within:ring-primary transition-all">
        <Icon name="search" className="text-content-variant mr-2" size={18} />
        <input
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent outline-none py-2 text-content text-sm placeholder-content-variant"
        />
      </div>

      {/* Table */}
      <div className="max-h-72 overflow-y-auto -mx-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-low sticky top-0">
            <tr className="border-b border-outline-variant/50">
              <th className="text-left px-6 py-2.5 label-caps text-content-variant">Date</th>
              <th className="text-left px-6 py-2.5 label-caps text-content-variant">Description</th>
              {showType && <th className="text-left px-6 py-2.5 label-caps text-content-variant">Type</th>}
              <th className="text-right px-6 py-2.5 label-caps text-content-variant">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-surface-low transition-colors">
                <td className="px-6 py-2.5 font-data text-content-variant whitespace-nowrap">{t.date}</td>
                <td className="px-6 py-2.5 text-content">{t.description || '—'}</td>
                {showType && (
                  <td className="px-6 py-2.5">
                    <span className={`chip label-caps ${
                      t.isRefund || t.transaction_type === 'income' ? 'bg-secondary-container text-secondary-on-container' :
                      t.transaction_type === 'expense' ? 'bg-surface-container text-content-variant' :
                      'bg-primary-fixed text-primary-on-fixed'
                    }`}>
                      {t.isRefund ? 'refund' : t.transaction_type}
                    </span>
                  </td>
                )}
                <td className={`px-6 py-2.5 text-right font-data font-semibold ${t.isRefund ? 'text-positive' : 'text-content'}`}>
                  {t.isRefund ? '+' : ''}${fmt2(t.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p className="text-sm text-content-variant mt-3 pt-3 border-t border-outline-variant/30">
        Total: <span className="font-data text-content">${fmt2(total)}</span>
      </p>
    </div>
  )
}
