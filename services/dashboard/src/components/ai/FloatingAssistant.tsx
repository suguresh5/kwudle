'use client'
import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

type AnomalyData = {
  summary?: string
  health_score?: number
  anomalies?: Array<{
    severity: 'critical' | 'warning' | 'info'
    metric: string
    description: string
    recommendation: string
  }>
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'var(--danger)',
  warning: 'var(--warning)',
  info: 'var(--brand)',
}

// ── High-tech Robot SVG Icon ──────────────────────────────────────────────────
function RobotIcon({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Antenna with signal ball */}
      <line x1="12" y1="2" x2="12" y2="6" />
      <circle cx="12" cy="2" r="1.2" fill={color} />
      {/* Robot Head Frame */}
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      {/* Glowing Eyes */}
      <circle cx="8.5" cy="11" r="1.5" fill={color} />
      <circle cx="15.5" cy="11" r="1.5" fill={color} />
      {/* Tech Grid Mouth */}
      <line x1="8" y1="15" x2="16" y2="15" strokeWidth="1.5" />
      {/* Ear Sensors */}
      <line x1="1" y1="11" x2="3" y2="11" strokeWidth="2" />
      <line x1="21" y1="11" x2="23" y2="11" strokeWidth="2" />
    </svg>
  )
}

export function FloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [anomalyData, setAnomalyData] = useState<AnomalyData | null>(null)
  const [anomalyLoading, setAnomalyLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, anomalyData])

  // Load anomaly summary when panel first opens
  const loadAnomalyData = async () => {
    if (anomalyData || anomalyLoading) return
    setAnomalyLoading(true)
    try {
      const res = await fetch('/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: { source: 'floating_assistant', timestamp: new Date().toISOString() } }),
      })
      if (res.status === 429) {
        const data = await res.json()
        setMessages([{ role: 'assistant', content: `⏳ ${data.error}`, isError: true }])
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setMessages([{
          role: 'assistant',
          content: data.error || 'Connected. Ask me any question or discuss your system metrics.',
          isError: false,
        }])
        return
      }
      const data = await res.json()
      setAnomalyData(data)
      if (data.summary) {
        setMessages(prev => prev.length === 1 && prev[0].role === 'assistant' && prev[0].content === 'Quick Kwudle is ready. Ask me about your telemetry, revenue, or system health.'
          ? [{ role: 'assistant', content: data.summary }]
          : prev)
      }
    } catch {
      setMessages(prev => prev.length ? prev : [{ role: 'assistant', content: 'Quick Kwudle is ready to chat.', isError: false }])
    } finally {
      setAnomalyLoading(false)
    }
  }

  const handleOpen = () => {
    setOpen(true)
    setMessages(prev => prev.length ? prev : [{ role: 'assistant', content: 'Quick Kwudle is ready. Ask me about your telemetry, revenue, or system health.' }])
    // Let the panel paint before starting the slower telemetry scan.
    window.setTimeout(loadAnomalyData, 120)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const context = anomalyData ? `\nCurrent dashboard analysis:\n${JSON.stringify(anomalyData, null, 2)}` : ''
      const res = await fetch('/api/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: {
            question: text,
            context,
            previous_messages: messages.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n'),
          },
        }),
      })

      if (res.status === 429) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: `⏳ ${data.error}`, isError: true }])
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || 'Could not process request. Please try again.',
          isError: true,
        }])
        return
      }

      const data = await res.json()
      const reply = data.summary || (typeof data === 'string' ? data : JSON.stringify(data))
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Check your network and try again.',
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  const healthScore = anomalyData?.health_score ?? null
  const healthColor = healthScore == null ? 'var(--text-3)'
    : healthScore >= 80 ? 'var(--success)'
    : healthScore >= 60 ? 'var(--warning)'
    : 'var(--danger)'

  return (
    <>
      {/* ── FAB button with Robot Logo ────────────────────────────────────────── */}
      {!open && (
        <button
          id="kwudle-ai-fab"
          onClick={handleOpen}
          title="Open Quick Kwudle"
          style={{
            position: 'fixed', bottom: '28px', right: '28px', zIndex: 200,
            width: '56px', height: '56px', borderRadius: '50%', border: 'none',
            background: 'linear-gradient(135deg,#3b82f6 0%,#6366f1 100%)',
            boxShadow: '0 8px 28px rgba(99,102,241,0.5)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(99,102,241,0.65)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.5)'
          }}
        >
          <RobotIcon size={26} color="#ffffff" />
        </button>
      )}

      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          id="kwudle-ai-panel"
          style={{
            position: 'fixed', bottom: '24px', right: '24px', zIndex: 200,
            width: '420px', maxWidth: 'calc(100vw - 32px)',
            height: '580px', maxHeight: 'calc(100vh - 80px)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.2s ease both',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            background: 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
              }}>
                <RobotIcon size={20} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Quick Kwudle
                  <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '99px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', fontWeight: '700' }}>AI</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Fast telemetry assistant</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {healthScore !== null && (
                <div style={{
                  fontSize: '11.5px', fontWeight: '700', color: healthColor,
                  background: 'var(--bg-2)', padding: '3px 10px', borderRadius: '99px',
                  border: '1px solid var(--border)',
                }}>
                  Health {healthScore}%
                </div>
              )}
              <button
                onClick={() => setOpen(false)}
                title="Close assistant"
                style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  width: '28px', height: '28px', borderRadius: '8px',
                  cursor: 'pointer', color: 'var(--text-2)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                }}
              >✕</button>
            </div>
          </div>

          {/* Anomalies summary */}
          {anomalyLoading && (
            <div style={{ padding: '12px 18px', flexShrink: 0 }}>
              <div className="skeleton" style={{ height: '16px', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '16px', width: '70%' }} />
            </div>
          )}
          {anomalyData?.anomalies && anomalyData.anomalies.length > 0 && (
            <div style={{ padding: '10px 14px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {anomalyData.anomalies.slice(0, 2).map((a, i) => (
                <div key={i} style={{
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'var(--bg-2)', borderLeft: `3px solid ${SEVERITY_COLOR[a.severity] || 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: SEVERITY_COLOR[a.severity], textTransform: 'uppercase', marginBottom: '2px' }}>
                    {a.severity} · {a.metric}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{a.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '86%', padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.isError ? 'var(--danger-light)'
                    : msg.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'var(--bg-2)',
                  color: msg.role === 'user' ? 'white' : msg.isError ? 'var(--danger)' : 'var(--text)',
                  fontSize: '13px', lineHeight: '1.55',
                  border: msg.isError ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: msg.role === 'user' ? '0 4px 14px rgba(59,130,246,0.3)' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'var(--bg-2)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa',
                      animation: `blink 1.2s infinite ${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            display: 'flex', gap: '8px', padding: '12px 14px',
            borderTop: '1px solid var(--border)', flexShrink: 0,
            background: 'rgba(255,255,255,0.01)',
          }}>
            <input
              id="kwudle-ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask Quick Kwudle..."
              disabled={loading}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '13px', outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => {
                e.target.style.borderColor = 'var(--brand)'
              }}
              onBlur={e => {
                e.target.style.borderColor = 'var(--border)'
              }}
            />
            <button
              id="kwudle-ai-send"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              title="Send message"
              style={{
                width: '40px', height: '40px', borderRadius: '10px', border: 'none',
                background: input.trim() ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'var(--bg-2)',
                color: input.trim() ? 'white' : 'var(--text-3)',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: input.trim() ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
