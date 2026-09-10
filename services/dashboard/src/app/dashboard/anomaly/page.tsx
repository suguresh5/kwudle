'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'

const SEV: any = {
  critical: { color: 'var(--danger)', bg: 'var(--danger-light)', icon: '🚨', label: 'Critical' },
  warning: { color: 'var(--warning)', bg: 'var(--warning-light)', icon: '⚠️', label: 'Warning' },
  info: { color: 'var(--brand)', bg: 'var(--brand-light)', icon: 'ℹ️', label: 'Info' },
}

function HealthScore({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--success)' : score >= 60 ? 'var(--warning)' : 'var(--danger)'
  const c = 2 * Math.PI * 40
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-2)" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={c} strokeDashoffset={c - (score / 100) * c}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '22px', fontWeight: '800', color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '9px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>score</span>
        </div>
      </div>
      <span className={`badge ${score >= 80 ? 'badge-success' : score >= 60 ? 'badge-warning' : 'badge-danger'}`}>
        {score >= 80 ? 'Healthy' : score >= 60 ? 'Degraded' : 'Critical'}
      </span>
    </div>
  )
}

export default function AnomalyPage() {
  const { data: stats } = useSWR('anomaly', () => api.stats.overview(), { refreshInterval: 60000 })
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const analyze = async () => {
    if (!stats?.length) { setError('No data yet. Send some events first.'); return }
    setLoading(true); setError('')
    try {
      const totalEvents = stats.reduce((s: number, r: any) => s + Number(r.total_events || 0), 0)
      const totalErrors = stats.reduce((s: number, r: any) => s + Number(r.errors || 0), 0)
      const avgP99 = stats.reduce((s: number, r: any) => s + Number(r.p99_ms || 0), 0) / stats.length
      const latest = stats[0]
      const metrics = {
        dau: latest?.dau, total_events: totalEvents,
        error_rate: totalEvents > 0 ? (totalErrors / totalEvents * 100).toFixed(2) + '%' : '0%',
        avg_p99_ms: avgP99.toFixed(0),
        p50: latest?.p50_ms, p95: latest?.p95_ms, p99: latest?.p99_ms,
        event_types: [...new Set(stats.map((s: any) => s.event_type))],
        recent: stats.slice(0, 5).map((s: any) => ({ date: s.event_date, type: s.event_type, events: s.total_events, p99: s.p99_ms, errors: s.errors })),
      }
      const res = await fetch('/api/anomaly', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ metrics }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      data.analyzed_at = new Date().toISOString()
      setReport(data); setLastRun(new Date())
    } catch (err: any) { setError(err.message || 'Analysis failed.') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (stats?.length && !report && !loading) analyze() }, [stats])

  return (
    <div className="fade-up">
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.4px' }}>AI Anomaly Detection</h1>
            <span className="badge badge-brand">Powered by Claude</span>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
            Automatic detection of unusual patterns
            {lastRun && <span style={{ marginLeft: '8px', color: 'var(--text-3)' }}>· Last analyzed {lastRun.toLocaleTimeString()}</span>}
          </p>
        </div>
        <button onClick={analyze} disabled={loading} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
          {loading ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Analyzing…</> : '✦ Re-analyze'}
        </button>
      </div>

      {loading && !report && (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', border: '3px solid var(--brand-light)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div>
              <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Claude is analyzing your metrics…</p>
              <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Checking for anomalies, patterns, and optimization opportunities</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--danger)', margin: 0 }}>⚠️ {error}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>To enable AI analysis, add ANTHROPIC_API_KEY to your .env file and restart the dashboard.</p>
        </div>
      )}

      {report && (
        <>
          <div className="glass-card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <HealthScore score={report.health_score} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>Executive Summary</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-2)', lineHeight: '1.6', margin: 0 }}>{report.summary}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                {['critical', 'warning', 'info'].map(s => {
                  const count = (report.anomalies || []).filter((a: any) => a.severity === s).length
                  if (!count) return null
                  const cfg = SEV[s]
                  return <div key={s} style={{ textAlign: 'center', padding: '12px 20px', background: cfg.bg, borderRadius: '12px' }}>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: cfg.color }}>{count}</div>
                    <div style={{ fontSize: '11px', color: cfg.color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</div>
                  </div>
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(report.anomalies || []).map((a: any, i: number) => {
              const cfg = SEV[a.severity] || SEV.info
              return (
                <div key={i} className="glass-card" style={{ padding: '20px 24px', borderLeft: `3px solid ${cfg.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>{cfg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span className={`badge ${a.severity === 'critical' ? 'badge-danger' : a.severity === 'warning' ? 'badge-warning' : 'badge-brand'}`}>{cfg.label}</span>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>{a.metric}</h4>
                      </div>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-2)', lineHeight: '1.6', margin: '0 0 10px' }}>{a.description}</p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '1px', flexShrink: 0 }}>Fix:</span>
                        <span style={{ fontSize: '13px', color: cfg.color, fontWeight: '500', lineHeight: '1.5' }}>{a.recommendation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-3)', marginTop: '20px' }}>Analysis by Claude · {new Date(report.analyzed_at).toLocaleString()}</p>
        </>
      )}
    </div>
  )
}
