import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon'
import api from '../api/client'

const SUGGESTIONS = [
  'How can I save more?',
  'Analyze my spending',
  'What are my top categories?',
  'Forecast next month',
]

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
  }, [messages, loading])

  const send = async (text?: string) => {
    const userMsg = (text ?? input).trim()
    if (!userMsg || loading) return
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

  const online = status?.online
  const modelName = status?.model || 'local model'

  return (
    <div className="flex flex-col gap-gutter">
      <div>
        <h1 className="text-headline-lg text-content">Ask AI</h1>
        <p className="text-body-md text-content-variant mt-1">Private, on-device analysis of your finances.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-gutter">
        {/* Chat panel */}
        <section className="flex-1 flex flex-col card overflow-hidden !p-0 min-h-[calc(100vh-16rem)]">
          {/* Chat header */}
          <div className="px-6 py-4 border-b border-outline-variant/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary">
              <Icon name="smart_toy" fill />
            </div>
            <div>
              <h2 className="text-headline-md text-content leading-none">Aurelian AI</h2>
              <p className="text-body-sm flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full inline-block ${online ? 'bg-positive' : 'bg-danger'}`} />
                <span className={online ? 'text-positive' : 'text-danger'}>
                  {online ? `Online · ${modelName}` : 'Offline'}
                </span>
              </p>
            </div>
          </div>

          {/* Offline notice */}
          {status && !online && (
            <div className="mx-6 mt-4 rounded-lg bg-danger-container/30 border border-danger-container p-3">
              <p className="text-danger-dim text-sm">
                Ollama offline. Run <code className="font-data bg-surface-container px-1.5 py-0.5 rounded">ollama serve</code> to enable the assistant.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
                <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center text-primary mb-4">
                  <Icon name="smart_toy" fill size={30} />
                </div>
                <p className="text-content font-medium">Ask anything about your finances</p>
                <p className="text-content-variant text-sm mt-1">Everything runs locally — your data never leaves this device.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              msg.role === 'user' ? (
                <div key={i} className="flex gap-3 max-w-[85%] self-end flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-surface-high flex items-center justify-center text-content-variant shrink-0 mt-1">
                    <Icon name="person" fill size={18} />
                  </div>
                  <div className="bg-primary text-primary-on p-3 rounded-2xl rounded-tr-sm">
                    <p className="text-body-md whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3 max-w-[90%]">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-primary shrink-0 mt-1">
                    <Icon name="smart_toy" fill size={18} />
                  </div>
                  <div className="bg-surface-low p-3 rounded-2xl rounded-tl-sm border border-outline-variant/30">
                    <p className="text-body-md text-content whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              )
            ))}
            {loading && (
              <div className="flex gap-3 max-w-[90%]">
                <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-primary shrink-0 mt-1">
                  <Icon name="smart_toy" fill size={18} />
                </div>
                <div className="bg-surface-low p-3 rounded-2xl rounded-tl-sm border border-outline-variant/30">
                  <p className="text-body-md text-content-variant animate-pulse">Thinking…</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="p-4 bg-surface border-t border-outline-variant/40 flex flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading || !online}
                  className="whitespace-nowrap px-4 py-1.5 rounded-full border border-outline-variant text-content-variant text-body-sm hover:bg-secondary-container hover:text-secondary-on-container hover:border-secondary-container transition-all disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative flex items-end bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask Aurelian AI anything…"
                rows={1}
                className="w-full bg-transparent border-none resize-none py-3 px-4 text-body-md text-content focus:ring-0 outline-none max-h-32"
                style={{ minHeight: 48 }}
              />
              <div className="p-2">
                <button
                  onClick={() => send()}
                  disabled={loading || !input.trim()}
                  className="p-2 bg-primary text-primary-on rounded-lg hover:bg-primary-dim transition-colors disabled:opacity-50"
                >
                  <Icon name="send" fill size={18} />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Live Insights sidebar */}
        <aside className="w-full lg:w-80 flex flex-col gap-4">
          <h3 className="text-headline-md text-content flex items-center gap-2">
            <Icon name="insights" className="text-primary" /> How it works
          </h3>

          <InsightCard icon="lock" iconClass="text-primary" title="100% Local & Private">
            Your transactions are analyzed entirely on this device using Ollama. Nothing is sent to any cloud service or external API.
          </InsightCard>

          <InsightCard icon="smart_toy" iconClass="text-secondary" title="On-Device Model">
            {online
              ? <>Running <span className="font-data text-content">{modelName}</span>. Ask about spending trends, category breakdowns, or savings ideas.</>
              : <>The assistant is offline. Start Ollama with <code className="font-data bg-surface-container px-1.5 py-0.5 rounded">ollama serve</code> to begin.</>}
          </InsightCard>

          <InsightCard icon="tips_and_updates" iconClass="text-tertiary" title="Try Asking">
            <ul className="space-y-1.5 mt-1">
              {SUGGESTIONS.map(s => (
                <li key={s}>
                  <button
                    onClick={() => send(s)}
                    disabled={loading || !online}
                    className="text-left text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </InsightCard>
        </aside>
      </div>
    </div>
  )
}

function InsightCard({ icon, iconClass, title, children }: { icon: string; iconClass: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-2 mb-2">
        <Icon name={icon} className={`${iconClass} mt-0.5`} size={20} />
        <h4 className="text-body-lg font-bold text-content">{title}</h4>
      </div>
      <div className="text-body-sm text-content-variant">{children}</div>
    </div>
  )
}
