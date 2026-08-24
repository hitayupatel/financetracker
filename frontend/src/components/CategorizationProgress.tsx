import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/client'

export default function CategorizationProgress() {
  const [status, setStatus] = useState<any>(null)
  const [minimized, setMinimized] = useState(false)

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
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 border border-indigo-700 rounded-xl shadow-lg z-50 overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800/50"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="text-xs text-indigo-400 font-medium">
          {status.source === 'import' ? '🧠 Categorizing' : '🔄 Re-evaluating'}
          {' '}{status.progress}/{status.total}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{Math.round(pct)}%</span>
          {minimized ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {!minimized && (
        <div className="px-4 pb-3">
          <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">
            {status.updated} categorized • {status.total - status.progress} remaining
          </p>
        </div>
      )}
    </div>
  )
}
