'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { api } from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
type Suggestion = {
  id: string
  category: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  problem: string
  suggestion: string
  expected_impact: string
  data_evidence: string
  status: string
  generated_at: string
}

// ─── Priority config ──────────────────────────────────────────────────────────
const PRI: Record<string, { border: string; badge: string; badgeColor: string; label: string; emoji: string }> = {
  HIGH:   { border: 'var(--danger)',   badge: 'var(--danger-light)',   badgeColor: 'var(--danger)',   label: 'High Priority',   emoji: '🔴' },
  MEDIUM: { border: 'var(--warning)',  badge: 'var(--warning-light)',  badgeColor: 'var(--warning)',  label: 'Medium Priority', emoji: '🟡' },
  LOW:    { border: 'var(--success)',  badge: 'var(--success-light)',  badgeColor: 'var(--success)',  label: 'Low Priority',    emoji: '🟢' },
}

// ─── Suggestion card ──────────────────────────────────────────────────────────
function SuggestionCard({
  item, onDone, onDismiss,
}: {
  item: Suggestion
  onDone: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
}) {
  const [removing, setRemoving] = useState(false)
  const [loading,  setLoading]  = useState<'done' | 'dismiss' | null>(null)
  const p = PRI[item.priority] ?? PRI.LOW

  const handle = async (action: 'done' | 'dismiss') => {
    setLoading(action)
    try {
      if (action === 'done') await onDone(item.id)
      else await onDismiss(item.id)
      setRemoving(true)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{
      border: `1px solid var(--glass-border)`,
      borderLeft: `3px solid ${p.border}`,
      borderRadius: '16px',
      padding: '22px',
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(16px)',
      boxShadow: 'var(--shadow)',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
      opacity: removing ? 0 : 1,
      maxHeight: removing ? 0 : '800px',
      marginBottom: removing ? 0 : undefined,
      animation: 'fadeUp 0.3s ease both',
    }}>
      {/* Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: p.badge, color: p.badgeColor }}>
          {item.priority}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: 'var(--brand-light)', color: 'var(--brand)' }}>
          {item.category}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {format(new Date(item.generated_at), 'MMM d, HH:mm')}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px', letterSpacing: '-0.3px' }}>
        {item.title}
      </h3>

      {/* Problem */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Problem</div>
        <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{item.problem}</p>
      </div>

      {/* Suggestion */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px', padding: '12px 14px', background: 'var(--bg-2)', borderRadius: '10px' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>💡</span>
        <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{item.suggestion}</p>
      </div>

      {/* Impact */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>📈</span>
        <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5, margin: 0 }}>{item.expected_impact}</p>
      </div>

      {/* Evidence */}
      <pre style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: 'var(--text-2)',
        background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '10px 12px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        lineHeight: 1.5, marginBottom: '16px',
      }}>
        {item.data_evidence}
      </pre>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => handle('done')}
          disabled={loading !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
            background: loading === 'done' ? 'var(--success-light)' : 'var(--success)',
            color: loading === 'done' ? 'var(--success)' : 'white',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            opacity: loading !== null ? 0.7 : 1,
          }}
        >
          {loading === 'done' ? '…' : '✓'} Done
        </button>
        <button
          onClick={() => handle('dismiss')}
          disabled={loading !== null}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '9px', border: '1px solid var(--border-strong)', cursor: 'pointer',
            background: 'transparent', color: 'var(--text-2)',
            fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
            opacity: loading !== null ? 0.7 : 1,
          }}
        >
          {loading === 'dismiss' ? '…' : '✕'} Dismiss
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SuggestionsPage() {
  const { data, isLoading, mutate } = useSWR('suggestions', api.suggestions.list, { refreshInterval: 60000 })
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const suggestions = (data ?? []) as Suggestion[]
  const active   = suggestions.filter(s => s.status === 'active')
  const highPri  = active.filter(s => s.priority === 'HIGH').length
  const done     = suggestions.filter(s => s.status === 'done').length
  const lastGen  = suggestions[0]?.generated_at

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleDone = async (id: string) => {
    await api.suggestions.markDone(id)
    await mutate()
    showToast('Marked as done ✓')
  }

  const handleDismiss = async (id: string) => {
    await api.suggestions.dismiss(id)
    await mutate()
  }

  const handleRegenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      })
      const json = await res.json()
      if (json.success) {
        await mutate()
        showToast(`Generated ${json.count} new suggestions ✨`)
      } else {
        showToast(`Failed: ${json.error}`)
      }
    } catch (e: any) {
      showToast(`Error: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const GROUPS: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW']

  return (
    <div className="fade-up">
      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(16px)', borderRadius: '12px',
          padding: '12px 18px', fontSize: '13px', fontWeight: 600,
          color: 'var(--text)', boxShadow: 'var(--shadow-lg)',
          animation: 'fadeUp 0.2s ease both',
        }}>
          {toast}
        </div>
      )}

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', marginBottom: '4px' }}>
            AI Suggestions
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            {lastGen ? <>Last generated: <span style={{ color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace' }}>{format(new Date(lastGen), 'MMM d, yyyy HH:mm')}</span></> : 'No suggestions generated yet'}
          </p>
        </div>
        <button
          onClick={handleRegenerate}
          disabled={generating}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white',
            fontSize: '13px', fontWeight: 600, opacity: generating ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          <span style={{ display: 'inline-block', animation: generating ? 'spin 0.8s linear infinite' : 'none', fontSize: '14px' }}>⟳</span>
          {generating ? 'Generating…' : 'Re-generate'}
        </button>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', margin: '24px 0' }}>
        <MetricCard label="Total Suggestions" value={active.length.toString()} icon="✦" trend="neutral" loading={isLoading} />
        <MetricCard label="High Priority" value={highPri.toString()} icon="🔴" trend={highPri > 0 ? 'down' : 'up'} trendValue={highPri > 0 ? 'Needs attention' : 'All clear'} loading={isLoading} />
        <MetricCard label="Completed" value={done.toString()} icon="✓" trend="up" loading={isLoading} />
      </div>

      {/* ── Skeleton ─────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card" style={{ padding: '22px' }}>
              <div className="skeleton" style={{ height: 14, width: '20%', marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: '70%', marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="skeleton" style={{ height: 36, width: 80, borderRadius: 9 }} />
                <div className="skeleton" style={{ height: 36, width: 90, borderRadius: 9 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Groups ───────────────────────────────────────────────────── */}
      {!isLoading && GROUPS.map(priority => {
        const group = active.filter(s => s.priority === priority)
        if (group.length === 0) return null
        const p = PRI[priority]
        return (
          <div key={priority} style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '15px' }}>{p.emoji}</span>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{p.label}</h2>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '99px', background: p.badge, color: p.badgeColor }}>{group.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {group.map(item => (
                <SuggestionCard
                  key={item.id}
                  item={item}
                  onDone={handleDone}
                  onDismiss={handleDismiss}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!isLoading && active.length === 0 && (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>✦</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>No suggestions yet</div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
            Suggestions are generated automatically every midnight based on your event data.
            You can also trigger them manually using the Re-generate button above.
          </div>
        </div>
      )}
    </div>
  )
}
