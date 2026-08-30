import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import api from '../api/client'

const fmt2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Import() {
  const [accounts, setAccounts] = useState<any[]>([])
  const [accountId, setAccountId] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [preview, setPreview] = useState<any>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv')
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
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
    <div className="flex flex-col gap-gutter">
      <div>
        <h1 className="text-headline-lg text-content">Import Statements</h1>
        <p className="text-body-md text-content-variant mt-1">Upload a CSV or PDF bank statement. Categorization runs locally.</p>
      </div>

      {/* Account selector */}
      <div className="card p-6">
        <label className="label-caps text-content-variant block mb-2">Import to Account</label>
        <select
          value={accountId || ''}
          onChange={e => setAccountId(+e.target.value)}
          className="input w-full max-w-sm"
        >
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Upload area */}
      <label
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFileSelect(f) }}
        className={`card !bg-surface-lowest border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors block ${dragOver ? 'border-primary bg-surface-low' : 'border-outline-variant/60 hover:border-primary'}`}
      >
        <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-primary mx-auto mb-4">
          <Icon name="upload_file" size={30} />
        </div>
        <p className="text-content font-medium">{file ? file.name : 'Drop a CSV or PDF bank statement here'}</p>
        <p className="text-content-variant text-sm mt-1">or click to browse</p>
        <input
          type="file"
          accept=".csv,.pdf"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          className="hidden"
        />
      </label>

      {/* Preview */}
      {preview && !preview.error && (
        <div className="card p-6">
          <h2 className="text-headline-md text-content mb-4">Preview</h2>

          {fileType === 'csv' && preview.detected_format && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Indicator label="Date" found={preview.detected_format.has_date} />
              <Indicator label="Description" found={preview.detected_format.has_description} />
              <Indicator label="Amount" found={preview.detected_format.has_amount} />
              <Indicator label="Debit/Credit" found={preview.detected_format.has_debit_credit} />
            </div>
          )}

          {fileType === 'pdf' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <StatBox label="Institution" value={preview.institution_display} />
              <StatBox label="Year" value={preview.year} mono />
              <StatBox label="Transactions Found" value={preview.total_found} mono />
            </div>
          )}

          {/* Sample rows */}
          {fileType === 'csv' && preview.rows && (
            <div className="overflow-x-auto max-h-48 rounded-lg border border-outline-variant/40">
              <table className="w-full text-xs">
                <thead className="bg-surface-low sticky top-0">
                  <tr>
                    {preview.columns?.map((col: string) => (
                      <th key={col} className="text-left px-3 py-2 label-caps text-content-variant">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {preview.rows.slice(0, 5).map((row: any, i: number) => (
                    <tr key={i}>
                      {preview.columns?.map((col: string) => (
                        <td key={col} className="px-3 py-2 text-content-variant font-data">{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fileType === 'pdf' && preview.sample_transactions && (
            <div className="overflow-x-auto max-h-48 rounded-lg border border-outline-variant/40">
              <table className="w-full text-xs">
                <thead className="bg-surface-low sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 label-caps text-content-variant">Date</th>
                    <th className="text-left px-3 py-2 label-caps text-content-variant">Type</th>
                    <th className="text-right px-3 py-2 label-caps text-content-variant">Amount</th>
                    <th className="text-left px-3 py-2 label-caps text-content-variant">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {preview.sample_transactions.map((t: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-content-variant font-data">{t.date}</td>
                      <td className="px-3 py-2 text-content-variant">{t.type}</td>
                      <td className="px-3 py-2 text-content-variant text-right font-data">${fmt2(t.amount)}</td>
                      <td className="px-3 py-2 text-content-variant">{t.description?.slice(0, 40)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Amount sign rule (only for single amount column CSVs) */}
          {fileType === 'csv' && preview.detected_format?.has_amount && !preview.detected_format?.has_debit_credit && (
            <div className="mt-4">
              <label className="label-caps text-content-variant block mb-2">How should the Amount column be interpreted?</label>
              <select value={amountSignRule} onChange={e => setAmountSignRule(e.target.value)} className="input">
                <option>Negative = Expense, Positive = Income</option>
                <option>Positive = Expense, Negative = Income</option>
                <option>All values are Expenses</option>
                <option>All values are Income</option>
              </select>
            </div>
          )}

          <button onClick={handleImport} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
            <Icon name="download" size={18} /> {loading ? 'Importing…' : 'Import'}
          </button>
        </div>
      )}

      {preview?.error && (
        <div className="rounded-lg bg-danger-container/30 border border-danger-container p-4">
          <p className="text-danger-dim flex items-center gap-2"><Icon name="error" size={18} /> {preview.error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-lg border p-4 ${result.error || !result.success ? 'bg-danger-container/30 border-danger-container' : 'bg-secondary-container/50 border-secondary-container'}`}>
          {result.error ? (
            <p className="text-danger-dim flex items-center gap-2"><Icon name="error" size={18} /> {result.error}</p>
          ) : (
            <div>
              <p className="text-content font-semibold flex items-center gap-2">
                <Icon name="check_circle" className="text-positive" size={20} />
                Imported {result.imported} transactions ({result.skipped} skipped)
              </p>
              {result.institution && <p className="text-content-variant text-sm mt-1 ml-7">Detected: {result.institution}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Indicator({ label, found }: { label: string; found: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${found ? 'bg-secondary-container/50 border-secondary-container' : 'bg-surface-container border-outline-variant/40'}`}>
      <p className="label-caps text-content-variant">{label}</p>
      <p className={`font-semibold text-sm mt-0.5 flex items-center gap-1 ${found ? 'text-positive' : 'text-content-variant'}`}>
        <Icon name={found ? 'check' : 'close'} size={16} /> {found ? 'Found' : 'Missing'}
      </p>
    </div>
  )
}

function StatBox({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="bg-surface-low rounded-lg p-3">
      <p className="label-caps text-content-variant">{label}</p>
      <p className={`text-content font-medium mt-0.5 ${mono ? 'font-data' : ''}`}>{value}</p>
    </div>
  )
}
