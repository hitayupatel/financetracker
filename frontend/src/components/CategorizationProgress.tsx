import { useEffect, useState } from 'react'
import api from '../api/client'

export default function CategorizationProgress() {
  const [status, setStatus] = useState<any>(null)

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await api.get('/jobs/categorization/status')
        setStatus(res.data)
      } catch {}
    }, 2000)
    return () => clearInterval(poll)
  }, [])

  if (!status || !status.running) return null

  const pct = status.total > 0 ? (status.progress / status.total) * 100 : 0

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 border border-indigo-700 rounded-xl p-4 shadow-lg z-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-indigo-400 font-medium uppercase tracking-wide">
          {status.source === 'import' ? '🧠 Categorizing imports' : '🔄 Re-evaluating'}
        </span>
        <span className="text-xs text-gray-400">
          {status.progress}/{status.total}
        </span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        {status.updated} categorized • {Math.round(pct)}% complete
      </p>
    </div>
  )
}
