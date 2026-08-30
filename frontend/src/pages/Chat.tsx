import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import api from '../api/client'

export default function Chat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get('/chat/status').then(r => setStatus(r.data))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await api.post('/chat', { message: userMsg, history: messages })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to AI.' }])
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <h1 className="text-2xl font-bold text-content mb-4">Ask AI</h1>

      {/* Status */}
      {status && !status.online && (
        <div className="bg-danger/10 border border-danger/40 rounded-lg p-3 mb-4">
          <p className="text-danger text-sm">Ollama offline. Run: <code className="bg-surface-container px-1 rounded">ollama serve</code></p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🤖</p>
            <p className="text-content-variant">Ask anything about your finances</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-primary text-content'
                : 'bg-surface-container text-content border border-outline-variant/50'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface-container border border-outline-variant/50 rounded-xl px-4 py-3">
              <p className="text-sm text-content-variant animate-pulse">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your finances..."
          className="flex-1 bg-surface-container border border-outline-variant/50 rounded-xl px-4 py-3 text-content text-sm focus:outline-none focus:border-primary"
        />
        <button onClick={send} disabled={loading} className="bg-primary hover:bg-primary-dim text-content px-4 rounded-xl disabled:opacity-50">
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
