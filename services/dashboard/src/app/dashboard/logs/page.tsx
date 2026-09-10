'use client'
import useSWR from 'swr'
import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
type LogRow = {
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'
  service: string
  message: string
  details: string
  request_id: string
}

// ─── Level config ─────────────────────────────────────────────────────────────
const LEVEL_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
  INFO:  { bg: 'var(--success-light)',  color: 'var(--success)',  dot: '#10b981' },
  WARN:  { bg: 'var(--warning-light)',  color: 'var(--warning)',  dot: '#f59e0b' },
  ERROR: { bg: 'var(--danger-light)',   color: 'var(--danger)',   dot: '#ef4444' },
  DEBUG: { bg: 'var(--brand-light)',    color: 'var(--brand)',    dot: '#3b82f6' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string }) {
  const s = LEVEL_STYLE[level] ?? LEVEL_STYLE.INFO
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
      background: s.bg, color: s.color, letterSpacing: '0.04em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {level}
    </span>
  )
}

function ServiceBadge({ service }: { service: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '99px',
      fontSize: '10px', fontWeight: 600, background: 'var(--bg-2)',
      color: 'var(--text-2)', fontFamily: 'JetBrains Mono, monospace',
    }}>{service}</span>
  )
}

function LogRowItem({ row, expanded, onToggle }: { row: LogRow; expanded: boolean; onToggle: () => void }) {
  let prettyDetails = row.details
  try { prettyDetails = JSON.stringify(JSON.parse(row.details), null, 2) } catch {}

  return (
    <>
      <div
        onClick={onToggle}
        style={{
          display: 'grid', gridTemplateColumns: '120px 80px 150px 1fr 32px',
          alignItems: 'center', gap: '12px', padding: '11px 20px',
          borderBottom: '1px solid var(--border)', cursor: 'pointer',
          transition: 'background 0.12s', background: expanded ? 'var(--bg-2)' : 'transparent',
        }}
        onMouseEnter={e => !expanded && (e.currentTarget.style.background = 'var(--bg-2)')}
        onMouseLeave={e => !expanded && (e.currentTarget.style.background = 'transparent')}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
            {format(new Date(row.timestamp), 'HH:mm:ss')}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
            {format(new Date(row.timestamp), 'MMM dd')}
          </div>
        </div>
        <LevelBadge level={row.level} />
        <ServiceBadge service={row.service} />
        <span style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.message}
        </span>
        <span style={{ fontSize: '16px', color: expanded ? 'var(--brand)' : 'var(--text-3)', textAlign: 'center', transition: 'color 0.15s', flexShrink: 0 }}>
          {expanded ? '⊖' : '⊕'}
        </span>
      </div>
      {expanded && (
        <div style={{
          padding: '16px 20px 16px 36px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-2)',
          animation: 'fadeUp 0.18s ease both',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            Details · request_id: <span style={{ color: 'var(--brand)', fontFamily: 'JetBrains Mono, monospace' }}>{row.request_id || '—'}</span>
          </div>
          <pre style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '12px',
            color: 'var(--text)', background: 'var(--bg-1)',
            border: '1px solid var(--border)', borderRadius: '10px',
            padding: '14px 16px', overflowX: 'auto', whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', lineHeight: 1.6, margin: 0,
          }}>
            {prettyDetails || '{}'}
          </pre>
        </div>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const SERVICES = ['sentinel-ingest', 'sentinel-api', 'sentinel-worker', 'sentinel-dashboard']
const LEVELS   = ['INFO', 'WARN', 'ERROR', 'DEBUG']
const HOURS_OPTIONS = [
  { label: 'Last 1h', value: '1' },
  { label: 'Last 6h', value: '6' },
  { label: 'Last 24h', value: '24' },
  { label: 'Last 7d', value: '168' },
]

const sel: React.CSSProperties = {
  background: 'var(--bg-2)', border: '1px solid var(--border-strong)',
  borderRadius: '10px', padding: '8px 12px', color: 'var(--text)',
  fontSize: '13px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const inp: React.CSSProperties = {
  ...sel, flex: 1, minWidth: '180px',
}

export default function LogsPage() {
  const [level,   setLevel]   = useState('')
  const [service, setService] = useState('')
  const [hours,   setHours]   = useState('24')
  const [search,  setSearch]  = useState('')
  const [dSearch, setDSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetcher = useCallback(
    () => api.logs.list({ level, service, hours, search: dSearch }),
    [level, service, hours, dSearch]
  )

  const { data: rows, isLoading } = useSWR(
    `logs:${level}:${service}:${hours}:${dSearch}`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const logs = (rows ?? []) as LogRow[]
  const totalLogs  = logs.length
  const errorCount = logs.filter(r => r.level === 'ERROR').length
  const highErrors = errorCount > 10

  return (
    <div className="fade-up">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
              Logs Explorer
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'blink 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', letterSpacing: '0.05em' }}>LIVE</span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>Structured logs from all services · Auto-refreshes every 5s</p>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────── */}
      {highErrors && (
        <div style={{ background: 'var(--danger)', color: 'white', borderRadius: '12px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'fadeUp 0.2s ease both' }}>
          <span style={{ fontSize: '16px' }}>⚠</span>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>High error rate detected — {errorCount} errors in the current window. Check the ERROR level logs below.</span>
        </div>
      )}

      {/* ── Metric cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '16px', marginBottom: '24px' }}>
        <MetricCard label="Total Logs" value={totalLogs.toLocaleString()} icon="◫" trend="neutral" loading={isLoading} />
        <MetricCard label="Errors (this window)" value={errorCount.toString()} icon="⚠" trend={errorCount > 0 ? 'down' : 'up'} trendValue={errorCount > 10 ? 'High!' : errorCount > 0 ? 'Low' : 'None'} loading={isLoading} />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px', padding: '14px 18px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '14px', backdropFilter: 'blur(16px)' }}>
        <select value={level} onChange={e => setLevel(e.target.value)} style={sel}>
          <option value="">All Levels</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select value={service} onChange={e => setService(e.target.value)} style={sel}>
          <option value="">All Services</option>
          {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={hours} onChange={e => setHours(e.target.value)} style={sel}>
          {HOURS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <input
          type="text"
          placeholder="Search messages…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inp}
        />

        {/* Live dot */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'blink 1.5s ease-in-out infinite' }} />
          <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>Live</span>
        </div>
      </div>

      {/* ── Logs table ───────────────────────────────────────────────── */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 80px 150px 1fr 32px', gap: '12px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          {['Timestamp', 'Level', 'Service', 'Message', ''].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>

        {/* Skeleton loading */}
        {isLoading && [...Array(5)].map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 80px 150px 1fr 32px', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ height: 14 }} />
            <div className="skeleton" style={{ height: 14, width: 50 }} />
            <div className="skeleton" style={{ height: 14, width: 120 }} />
            <div className="skeleton" style={{ height: 14 }} />
            <div className="skeleton" style={{ height: 14, width: 20 }} />
          </div>
        ))}

        {/* Rows */}
        {!isLoading && logs.map((row, i) => (
          <LogRowItem
            key={`${row.timestamp}-${i}`}
            row={row}
            expanded={expanded === `${row.timestamp}-${i}`}
            onToggle={() => setExpanded(expanded === `${row.timestamp}-${i}` ? null : `${row.timestamp}-${i}`)}
          />
        ))}

        {/* Empty state */}
        {!isLoading && logs.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>◫</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>No logs found</div>
            <div style={{ fontSize: '13px' }}>Adjust filters or send some events.</div>
          </div>
        )}
      </div>
    </div>
  )
}
