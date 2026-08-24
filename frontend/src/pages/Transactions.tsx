import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Transactions() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/transactions?limit=200'),
      api.get('/transactions/categories'),
    ]).then(([txnRes, catRes]) => {
      setTransactions(txnRes.data)
      setCategories(catRes.data)
      setLoading(false)
    })
  }, [])

  const getCategoryName = (id: number | null) => {
    if (!id) return '—'
    const cat = categories.find(c => c.id === id)
    return cat ? `${cat.icon} ${cat.name}` : '—'
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Transactions</h1>

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
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-300">{txn.date}</td>
                  <td className="px-4 py-3 text-gray-100">{txn.description || '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{getCategoryName(txn.category_id)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      txn.transaction_type === 'income' ? 'bg-green-900/50 text-green-400' :
                      txn.transaction_type === 'expense' ? 'bg-red-900/50 text-red-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      {txn.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-100">${txn.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
