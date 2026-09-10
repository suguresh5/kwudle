'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { api } from '@/lib/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'

const ENVS = ['production', 'staging', 'development']
const WINDOWS = [{ label: '1h', hours: 1 }, { label: '6h', hours: 6 }, { label: '24h', hours: 24 }, { label: '7d', hours: 168 }]

export default function DeploymentsPage() {
  const [env, setEnv] = useState('production')
  const [hours, setHours] = useState(24)
  const { data } = useSWR(['deps', env, hours], () => api.stats.deployments(env, hours), { refreshInterval: 60000 })

  const timeseries = (data?.timeseries ?? []).map((r: any) => ({
    time: r.minute ? format(new Date(r.minute), 'HH:mm') : '',
    errorRate: r.total_events > 0 ? ((r.error_events / r.total_events) * 100).toFixed(2) : 0,
    p99: Number(r.p99_ms?.toFixed(0)),
  }))

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.4px' }}>Deployments</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '4px' }}>Performance impact per release via ASOF JOIN</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-2)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {ENVS.map(e => <button key={e} onClick={() => setEnv(e)} style={{ padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: env === e ? 'var(--bg-1)' : 'transparent', color: env === e ? 'var(--text)' : 'var(--text-2)', boxShadow: env === e ? 'var(--shadow)' : 'none', transition: 'all 0.15s' }}>{e}</button>)}
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-2)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {WINDOWS.map(w => <button key={w.hours} onClick={() => setHours(w.hours)} style={{ padding: '6px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: hours === w.hours ? 'var(--bg-1)' : 'transparent', color: hours === w.hours ? 'var(--text)' : 'var(--text-2)', transition: 'all 0.15s' }}>{w.label}</button>)}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: '24px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)', marginBottom: '4px' }}>Error Rate & Latency</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>Yellow dashed lines = deployment boundaries</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="l" tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fill: 'var(--text-3)', fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip />
            {(data?.deployments ?? []).map((d: any, i: number) => (
              <ReferenceLine key={i} yAxisId="l" x={d.timestamp ? format(new Date(d.timestamp), 'HH:mm') : ''} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: `v${d.version}`, fill: '#f59e0b', fontSize: 10 }} />
            ))}
            <Line yAxisId="l" type="monotone" dataKey="errorRate" name="Error %" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line yAxisId="r" type="monotone" dataKey="p99" name="P99 ms" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Deployment History</h3>
        </div>
        {(data?.deployments ?? []).map((d: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span className="badge badge-warning">v{d.version}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-2)', fontFamily: 'monospace' }}>{d.timestamp ? format(new Date(d.timestamp), 'MMM d, HH:mm:ss') : '—'}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)' }}>by {d.deployed_by}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-3)', flex: 1 }}>{d.notes}</span>
          </div>
        ))}
        {!data?.deployments?.length && (
          <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>No deployments in this window. Add one via ClickHouse.</p>
        )}
      </div>
    </div>
  )
}
