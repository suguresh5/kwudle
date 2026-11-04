'use client'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { format } from 'date-fns'

export default function SessionsPage() {
  const { data: sessions, isLoading } = useSWR('sessions', () => api.stats.sessions(100), { refreshInterval: 30000 })
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const durations = (sessions ?? []).map((s: any) => s.duration_ms / 1000)
  const converted = (sessions ?? []).filter((s: any) => s.converted).length
  const convRate = sessions?.length ? ((converted / sessions.length) * 100).toFixed(1) : '0.0'

  return (
    <div className="fade-up">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.4px' }}>Session Explorer</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '4px' }}>User sessions via 30-minute gap stitching</p>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Sessions', value: sessions?.length?.toLocaleString() ?? '—', icon: '◉' },
          { label: 'Avg Duration', value: `${avg(durations).toFixed(1)}s`, icon: '⏱️' },
          { label: 'Conversion Rate', value: `${convRate}%`, icon: '🎯' },
          { label: 'Converted', value: converted.toString(), icon: '✅' },
        ].map(c => (
          <div key={c.label} className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</p>
              <span>{c.icon}</span>
            </div>
            <p style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px' }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Session List</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Started', 'Duration', 'Pages', 'Events', 'Device', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [...Array(8)].map((_, i) => <tr key={i}><td colSpan={7} style={{ padding: '12px 16px' }}><div className="skeleton" style={{ height: '14px' }} /></td></tr>)
                : (sessions ?? []).map((s: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s', cursor: 'default' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--brand)', fontFamily: 'monospace' }}>{s.user_id?.slice(0, 10) ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-2)' }}>{s.session_start ? format(new Date(s.session_start), 'MMM d, HH:mm') : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)', fontFamily: 'monospace' }}>{s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)' }}>{s.page_depth ?? 0}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text)' }}>{s.event_count ?? 0}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-2)', textTransform: 'capitalize' }}>{s.device_type ?? 'desktop'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.converted ? <span className="badge badge-success">✓ Converted</span> : <span className="badge" style={{ background: 'var(--bg-2)', color: 'var(--text-3)' }}>Browsed</span>}
                    </td>
                  </tr>
                ))}
              {!isLoading && !sessions?.length && (
                <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>No sessions yet. Send events with the same user_id to see sessions.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
