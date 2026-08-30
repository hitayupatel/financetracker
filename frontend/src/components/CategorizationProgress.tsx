import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import api from '../api/client'

export default function CategorizationProgress() {
  const [status, setStatus] = useState<any>(null)
  const [minimized, setMinimized] = useState(false)
  const [showFailed, setShowFailed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await api.get('/jobs/categorization/status')
        setStatus(res.data)
      } catch {}
    }, 2000)
    return () => clearInterval(poll)
  }, [])

  // Show while running, OR when just done with results (until dismissed)
  const isRunning = status?.running
  const justDone = status?.done && (status?.updated > 0 || status?.failed > 0) && !dismissed

  if (!status || (!isRunning && !justDone)) return null

  const pct = status.total > 0 ? (status.progress / status.total) * 100 : 0

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gray-900 border border-indigo-700 rounded-xl shadow-lg z-50 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800/50"
        onClick={() => setMinimized(!minimized)}
      >
        <span className="text-xs text-indigo-400 font-medium">
          {isRunning
            ? `${status.source === 'import' ? 'Categorizing' : 'Re-evaluating'} ${status.progress}/${status.total}`
            : 'Categorization complete'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{Math.round(pct)}%</span>
          {minimized ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div className="px-4 pb-3">
          <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs mb-2">
            <span className="text-green-400">✓ {status.updated} categorized</span>
            <span className="text-amber-400">⚠ {status.failed} failed</span>
            {isRunning && <span className="text-gray-500">{status.total - status.progress} left</span>}
          </div>

          {/* Failed items toggle */}
          {status.failed > 0 && (
            <div>
              <button
                onClick={() => setShowFailed(!showFailed)}
                className="text-xs text-amber-400 hover:text-amber-300 underline"
              >
                {showFailed ? 'Hide' : 'View'} {status.failed} uncategorized
              </button>
              {showFailed && (
                <div className="mt-2 max-h-40 overflow-y-auto bg-gray-800 rounded-lg p-2">
                  {status.failed_items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-700 last:border-0">
                      <span className="text-gray-300 truncate mr-2">{item.description}</span>
                      <span className="text-gray-500 font-mono whitespace-nowrap">${item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dismiss button when done */}
          {justDone && (
            <button
              onClick={() => setDismissed(true)}
              className="mt-2 w-full text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-1.5"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
