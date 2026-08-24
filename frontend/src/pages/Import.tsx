import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Import() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/accounts').then(r => {
      setAccounts(r.data)
      if (r.data.length > 0) setAccountId(r.data[0].id)
    })
  }, [])

  const handleUpload = async (file: File, type: 'csv' | 'pdf') => {
    if (!accountId) return
    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_id', String(accountId))
    formData.append('default_type', 'expense')

    try {
      const res = await api.post(`/import/${type}`, formData)
      setResult(res.data)
    } catch (e: any) {
      setResult({ error: e.response?.data?.detail || 'Import failed' })
    }
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Import Statements</h1>

      {/* Account selector */}
      <div className="mb-6">
        <label className="text-sm text-gray-400 block mb-2">Import to Account</label>
        <select
          value={accountId || ''}
          onChange={e => setAccountId(+e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full max-w-xs"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Upload area */}
      <div className="bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors">
        <p className="text-gray-400 mb-4">Drop a CSV or PDF bank statement here, or click to browse</p>
        <input
          type="file"
          accept=".csv,.pdf"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              const type = file.name.endsWith('.pdf') ? 'pdf' : 'csv'
              handleUpload(file, type)
            }
          }}
          className="text-sm text-gray-400"
        />
      </div>

      {/* Loading */}
      {loading && <p className="text-indigo-400 mt-4">Importing...</p>}

      {/* Result */}
      {result && (
        <div className={`mt-6 p-4 rounded-xl border ${result.error || !result.success ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <div>
              <p className="text-green-400 font-medium">
                Imported {result.imported} transactions ({result.skipped} skipped)
              </p>
              {result.institution && <p className="text-gray-400 text-sm mt-1">Detected: {result.institution}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
