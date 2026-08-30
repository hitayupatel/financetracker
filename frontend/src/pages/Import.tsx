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
      <h1 className="text-2xl font-bold text-content mb-6">Import Statements</h1>

      {/* Account selector */}
      <div className="mb-6">
        <label className="text-sm text-content-variant block mb-2">Import to Account</label>
        <select
          value={accountId || ''}
          onChange={e => setAccountId(+e.target.value)}
          className="bg-surface-container border border-outline-variant/50 rounded-lg px-4 py-2 text-content text-sm w-full max-w-xs"
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Upload area */}
      <div className="bg-surface-lowest border-2 border-dashed border-outline-variant/50 rounded-xl p-12 text-center hover:border-primary transition-colors mb-6">
        <p className="text-content-variant mb-4">Drop a CSV or PDF bank statement here</p>
        <input
          type="file"
          accept=".csv,.pdf"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) handleFileSelect(f)
          }}
          className="text-sm text-content-variant"
        />
      </div>

      {/* Preview */}
      {preview && !preview.error && (
        <div className="bg-surface-lowest border border-outline-variant/30 rounded-lg shadow-level-1 p-6 mb-6">
          <h2 className="text-lg font-semibold text-content mb-4">Preview</h2>

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
              <div className="bg-surface-container rounded-lg p-3">
                <p className="text-xs text-content-variant">Institution</p>
                <p className="text-content font-medium">{preview.institution_display}</p>
              </div>
              <div className="bg-surface-container rounded-lg p-3">
                <p className="text-xs text-content-variant">Year</p>
                <p className="text-content font-medium">{preview.year}</p>
              </div>
              <div className="bg-surface-container rounded-lg p-3">
                <p className="text-xs text-content-variant">Transactions Found</p>
                <p className="text-content font-medium">{preview.total_found}</p>
              </div>
            </div>
          )}

          {/* Sample rows */}
          {fileType === 'csv' && preview.rows && (
            <div className="overflow-x-auto max-h-48 text-xs">
              <table className="w-full">
                <thead className="bg-surface-container">
                  <tr>
                    {preview.columns?.map((col: string) => (
                      <th key={col} className="text-left px-2 py-1 text-content-variant">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((row: any, i: number) => (
                    <tr key={i} className="border-t border-outline-variant/40">
                      {preview.columns?.map((col: string) => (
                        <td key={col} className="px-2 py-1 text-content-variant">{String(row[col] ?? '')}</td>
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
                <thead className="bg-surface-container">
                  <tr>
                    <th className="text-left px-2 py-1 text-content-variant">Date</th>
                    <th className="text-left px-2 py-1 text-content-variant">Type</th>
                    <th className="text-right px-2 py-1 text-content-variant">Amount</th>
                    <th className="text-left px-2 py-1 text-content-variant">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample_transactions.map((t: any, i: number) => (
                    <tr key={i} className="border-t border-outline-variant/40">
                      <td className="px-2 py-1 text-content-variant">{t.date}</td>
                      <td className="px-2 py-1 text-content-variant">{t.type}</td>
                      <td className="px-2 py-1 text-content-variant text-right">${t.amount.toFixed(2)}</td>
                      <td className="px-2 py-1 text-content-variant">{t.description?.slice(0, 40)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Amount sign rule (only for single amount column CSVs) */}
          {fileType === 'csv' && preview.detected_format?.has_amount && !preview.detected_format?.has_debit_credit && (
            <div className="mt-4">
              <label className="text-sm text-content-variant block mb-2">How should the Amount column be interpreted?</label>
              <select
                value={amountSignRule}
                onChange={e => setAmountSignRule(e.target.value)}
                className="bg-surface-container border border-outline-variant/50 rounded-lg px-3 py-2 text-content text-sm"
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
            className="mt-4 bg-primary hover:bg-primary-dim disabled:opacity-50 text-content px-6 py-2 rounded-lg text-sm font-medium"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      )}

      {preview?.error && (
        <div className="bg-danger/10 border border-danger/40 rounded-xl p-4 mb-6">
          <p className="text-danger">{preview.error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`p-4 rounded-xl border ${result.error || !result.success ? 'bg-danger/10 border-danger/40' : 'bg-green-900/20 border-green-800'}`}>
          {result.error ? (
            <p className="text-danger">{result.error}</p>
          ) : (
            <div>
              <p className="text-positive font-medium">
                Imported {result.imported} transactions ({result.skipped} skipped)
              </p>
              {result.institution && <p className="text-content-variant text-sm mt-1">Detected: {result.institution}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Indicator({ label, found }: { label: string; found: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${found ? 'bg-green-900/20 border border-green-800' : 'bg-surface-container border border-outline-variant/50'}`}>
      <p className="text-xs text-content-variant">{label}</p>
      <p className={`font-medium ${found ? 'text-positive' : 'text-content-variant'}`}>{found ? '✓ Found' : '✗ Missing'}</p>
    </div>
  )
}
