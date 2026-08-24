import { useEffect, useState } from 'react'
import api from '../api/client'

export default function Import() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv')
  const [loading, setLoading] = useState(false)
  const [amountSignRule, setAmountSignRule] = useState('Negative = Expense, Positive = Income')

  useEffect(() => {
    api.get('/accounts').then(r => {
      setAccounts(r.data)
      if (r.data.length > 0) setAccountId(r.data[0].id)
    })
  }, [])

  const handleFileSelect = async (f: File) => {
    setFile(f)
    setResult(null)
    const type = f.name.endsWith('.pdf') ? 'pdf' : 'csv'
    setFileType(type)

    // Get preview
    const formData = new FormData()
    formData.append('file', f)
    try {
      const res = await api.post(`/import/${type}/preview`, formData)
      setPreview(res.data)
    } catch {
      setPreview(null)
    }
  }

  const handleImport = async () => {
    if (!file || !accountId) return
    setLoading(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_id', String(accountId))
    formData.append('default_type', 'expense')
    if (fileType === 'csv' && preview?.detected_format?.has_amount && !preview?.detected_format?.has_debit_credit) {
      formData.append('amount_sign_rule', amountSignRule)
    }

    try {
      const res = await api.post(`/import/${fileType}`, formData)
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
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Upload area */}
      <div className="bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:border-indigo-500 transition-colors mb-6">
        <p className="text-gray-400 mb-4">Drop a CSV or PDF bank statement here</p>
        <input
          type="file"
          accept=".csv,.pdf"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFileSelect(f)
          }}
          className="text-sm text-gray-400"
        />
      </div>

      {/* Preview */}
      {preview && !preview.error && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Preview</h2>

          {fileType === 'csv' && preview.detected_format && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Indicator label="Date" found={preview.detected_format.has_date} />
              <Indicator label="Description" found={preview.detected_format.has_description} />
              <Indicator label="Amount" found={preview.detected_format.has_amount} />
              <Indicator label="Debit/Credit" found={preview.detected_format.has_debit_credit} />
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500">Institution</p>
                <p className="text-white font-medium">{preview.institution_display}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500">Year</p>
                <p className="text-white font-medium">{preview.year}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-500">Transactions Found</p>
                <p className="text-white font-medium">{preview.total_found}</p>
              </div>
            </div>
          )}

          {/* Sample rows */}
          {fileType === 'csv' && preview.rows && (
            <div className="overflow-x-auto max-h-48 text-xs">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    {preview.columns?.map((col: string) => (
                      <th key={col} className="text-left px-2 py-1 text-gray-400">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row: any, i: number) => (
                    <tr key={i} className="border-t border-gray-800">
                      {preview.columns?.map((col: string) => (
                        <td key={col} className="px-2 py-1 text-gray-300">{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fileType === 'pdf' && preview.sample_transactions && (
            <div className="overflow-x-auto max-h-48 text-xs">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="text-left px-2 py-1 text-gray-400">Date</th>
                    <th className="text-left px-2 py-1 text-gray-400">Type</th>
                    <th className="text-right px-2 py-1 text-gray-400">Amount</th>
                    <th className="text-left px-2 py-1 text-gray-400">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_transactions.map((t: any, i: number) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-2 py-1 text-gray-300">{t.date}</td>
                      <td className="px-2 py-1 text-gray-300">{t.type}</td>
                      <td className="px-2 py-1 text-gray-300 text-right">${t.amount.toFixed(2)}</td>
                      <td className="px-2 py-1 text-gray-300">{t.description?.slice(0, 40)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Amount sign rule (only for single amount column CSVs) */}
          {fileType === 'csv' && preview.detected_format?.has_amount && !preview.detected_format?.has_debit_credit && (
            <div className="mt-4">
              <label className="text-sm text-gray-400 block mb-2">How should the Amount column be interpreted?</label>
              <select
                value={amountSignRule}
                onChange={e => setAmountSignRule(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option>Negative = Expense, Positive = Income</option>
                <option>Positive = Expense, Negative = Income</option>
                <option>All values are Expenses</option>
                <option>All values are Income</option>
              </select>
            </div>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={loading}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      )}

      {preview?.error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-400">{preview.error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl border ${result.error || !result.success ? 'bg-red-900/20 border-red-800' : 'bg-green-900/20 border-green-800'}`}>
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

function Indicator({ label, found }: { label: string; found: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${found ? 'bg-green-900/20 border border-green-800' : 'bg-gray-800 border border-gray-700'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-medium ${found ? 'text-green-400' : 'text-gray-500'}`}>{found ? '✓ Found' : '✗ Missing'}</p>
    </div>
  )
}
