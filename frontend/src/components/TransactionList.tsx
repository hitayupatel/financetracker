import { useState } from 'react'
import { Search } from 'lucide-react'

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

export default function TransactionList({ transactions, title, onClose, showType = false }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? transactions.filter(t => (t.description || '').toLowerCase().includes(search.toLowerCase()))
    : transactions

  const total = filtered.reduce((s, t) => s + (t.isRefund ? -t.amount : t.amount), 0)

  return (
    <div className="bg-surface-lowest border border-outline-variant/50 rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {title && <h2 className="text-lg font-semibold text-content">{title} ({filtered.length})</h2>}
        {onClose && <button onClick={onClose} className="text-content-variant hover:text-content text-sm">✕ Close</button>}
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-2.5 text-content-variant" />
        <input
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-surface-container border border-outline-variant/50 rounded-lg pl-8 pr-3 py-2 text-content text-sm"
        />
      </div>

      {/* Table */}
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 text-content-variant">Date</th>
              <th className="text-left px-3 py-2 text-content-variant">Description</th>
              {showType && <th className="text-left px-3 py-2 text-content-variant">Type</th>}
              <th className="text-right px-3 py-2 text-content-variant">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-t border-outline-variant/40">
                <td className="px-3 py-2 text-content-variant">{t.date}</td>
                <td className="px-3 py-2 text-content">{t.description || '—'}</td>
                {showType && (
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      t.isRefund ? 'bg-positive/15 text-positive' :
                      t.transaction_type === 'income' ? 'bg-positive/15 text-positive' :
                      t.transaction_type === 'expense' ? 'bg-danger/15 text-danger' :
                      'bg-blue-900/50 text-primary'
                    }`}>
                      {t.isRefund ? 'Refund' : t.transaction_type}
                    </span>
                  </td>
                )}
                <td className={`px-3 py-2 text-right font-mono ${t.isRefund ? 'text-positive' : 'text-content'}`}>
                  {t.isRefund ? '+' : ''}${t.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <p className="text-xs text-content-variant mt-2">
        Total: ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}
