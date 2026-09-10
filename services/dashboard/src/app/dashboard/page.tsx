'use client'
import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { api } from '@/lib/api'
import { MetricCard } from '@/components/ui/MetricCard'
import { DarkVeil } from '@/components/ui/DarkVeil'
import BusinessPage from '@/app/dashboard/business/page'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { format, isValid } from 'date-fns'
import { useEffect, useState } from 'react'


// Safe date formatter — returns fallback string if date is null/invalid
// instead of throwing (which crashes the entire page to black screen)
function safeFormat(date: string | Date | null | undefined, fmt: string, fallback = ''): string {
  if (!date) return fallback
  const d = new Date(date)
  return isValid(d) ? format(d, fmt) : fallback
}

const Globe = dynamic(
  () => import('@/components/globe/Globe').then(m => ({ default: m.Globe })),
  { ssr: false }
)

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.94)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '10px',
      padding: '10px 14px',
      backdropFilter: 'blur(12px)',
      boxShadow: 'var(--shadow-lg)',
      fontSize: '12px',
      minWidth: '160px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{label}</span>
        {payload[0]?.payload?.deployment_version && (
          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 700 }}>
            {payload[0].payload.deployment_version}
          </span>
        )}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey || p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color }} />
            <span style={{ color: 'var(--text-2)' }}>{p.name}:</span>
          </div>
          <span style={{ color: '#fff', fontWeight: '700', fontFamily: 'JetBrains Mono, monospace' }}>
            {p.name?.includes('$') || p.dataKey === 'revenue'
              ? `₹${Number(p.value).toLocaleString('en-IN')}`
              : p.dataKey === 'errorRate'
                ? `${Number(p.value).toFixed(2)}%`
                : p.dataKey === 'p99'
                  ? `${Number(p.value).toFixed(0)}ms`
                  : typeof p.value === 'number'
                    ? p.value.toLocaleString()
                    : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function KPI({ icon, label, value, sub, color = 'var(--brand)' }: {
  icon: string; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="metric-card" style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
      <span style={{ fontSize:'20px' }}>{icon}</span>
      <div style={{ fontSize:'24px', fontWeight:'800', color, letterSpacing:'-0.5px' }}>{value}</div>
      <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--text)' }}>{label}</div>
      {sub && <div style={{ fontSize:'11px', color:'var(--text-3)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  // ── Per-card filter states ────────────────────────────────────────────────
  const [dauWindow, setDauWindow] = useState<'7d' | '14d' | '30d'>('14d')

  const { data: stats, isLoading } = useSWR('overview', () => api.stats.overview(), { refreshInterval: 30000 })
  const { data: businessRevenue } = useSWR('command-business-revenue', () => api.business.revenue({ days: '30', granularity: 'day' }), { refreshInterval: 30000 })
  const { data: loyalty } = useSWR('command-business-loyalty', () => api.business.customerLoyalty({ days: '30' }), { refreshInterval: 30000 })

  const [globeReady, setGlobeReady] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => { setMounted(true); setTimeout(() => setGlobeReady(true), 400) }, [])
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  // ── Metrics calculations ──────────────────────────────────────────────────
  const latest = stats?.[0]
  const errRate = latest ? ((Number(latest.errors || 0) / Math.max(Number(latest.total_events || 1), 1)) * 100).toFixed(2) : '0.00'
  const businessRows = businessRevenue ?? []
  const businessRevenueTotal = businessRows.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0)
  const businessOrders = businessRows.reduce((sum: number, row: any) => sum + Number(row.order_count || 0), 0)
  const businessAverageOrder = businessOrders > 0 ? businessRevenueTotal / businessOrders : 0
  const businessLoyalty = loyalty?.[0] ?? {}

  // ── Full time series dataset ──────────────────────────────────────────────
  const rawChartData = (stats ?? []).slice().reverse().map((s: any) => ({
    date: safeFormat(s.event_date, 'MMM d'),
    dau: Number(s.dau || 0),
    events: Number(s.total_events || 0),
    p99: Number(s.p99_ms?.toFixed(0) || 0)
  }))

  // Filtered DAU dataset
  const dauLimit = dauWindow === '7d' ? 7 : dauWindow === '14d' ? 14 : 30
  const dauChartData = rawChartData.slice(-dauLimit)

  return (
    <>
      <DarkVeil />
      <div className="fade-up" style={{ position: 'relative', zIndex: 1 }}>
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px' }}>
              Command Center
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'blink 2s ease-in-out infinite' }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#10b981', letterSpacing: '0.05em' }}>LIVE CONTROL</span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-2)' }}>
            Unified system health, active user telemetry & business revenue analytics ·{' '}
            <span style={{ color: 'var(--success)', fontWeight: '600' }}>
              {latest?.dau ? `${Number(latest.dau).toLocaleString()} active users online` : 'Connecting…'}
            </span>
          </p>
        </div>
        <div suppressHydrationWarning style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', padding: '6px 12px', background: 'var(--bg-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {mounted ? now.toLocaleTimeString() : 'Live'}
        </div>
      </div>

      {/* ── System Health ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--brand)', boxShadow: '0 0 12px var(--brand)' }} />
        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>System health</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <MetricCard label="Daily Active Users" value={latest?.dau?.toLocaleString() || '—'} icon="users" trend="up" trendValue="+14%" loading={isLoading} />
        <MetricCard label="Total Events" value={latest?.total_events?.toLocaleString() || '—'} icon="events" trend="up" trendValue="+8%" loading={isLoading} />
        <MetricCard label="Error Rate" value={`${errRate}%`} icon="shield" trend={Number(errRate) > 1 ? 'down' : 'up'} trendValue="Healthy" loading={isLoading} />
        <MetricCard label="P99 Latency" value={latest?.p99_ms ? `${Number(latest.p99_ms).toFixed(0)}ms` : '—'} icon="clock" trend="neutral" sub={latest?.p50_ms ? `P50: ${Number(latest.p50_ms).toFixed(0)}ms` : undefined} loading={isLoading} />
      </div>

      {/* ── Business Performance ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 12px var(--success)' }} />
        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Business performance</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <KPI icon="💰" label="Revenue (period)" value={`₹${businessRevenueTotal.toLocaleString('en-IN', { maximumFractionDigits:0 })}`} sub="30d window" color="var(--success)" />
        <KPI icon="🛒" label="Orders" value={businessOrders.toLocaleString('en-IN')} sub={`Avg ₹${businessAverageOrder.toLocaleString('en-IN', { maximumFractionDigits:0 })}`} />
        <KPI icon="👤" label="New Customers" value={Number(businessLoyalty.new_customers || 0).toLocaleString('en-IN')} sub="unique buyers" />
        <KPI icon="♻️" label="Returning" value={`${Number(businessLoyalty.new_customers || 0) + Number(businessLoyalty.returning_customers || 0) > 0 ? ((Number(businessLoyalty.returning_customers || 0) / (Number(businessLoyalty.new_customers || 0) + Number(businessLoyalty.returning_customers || 0))) * 100).toFixed(1) : '0'}%`} sub="repeat rate" color="var(--success)" />
      </div>

      {/* ── Section 1: Globe + Expanded DAU Traffic Card ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '16px', marginBottom: '20px' }}>
        {/* WebGL 3D Satellite Globe Card */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>Satellite User Telemetry</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Live WebGL Satellite Globe</p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--brand)', fontWeight: '700', padding: '3px 8px', background: 'var(--brand-light)', borderRadius: '6px' }}>
              9 Active Regions
            </span>
          </div>
          {globeReady ? (
            <Globe size={260} />
          ) : (
            <div style={{ width: '260px', height: '260px', borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '36px', height: '36px', border: '3px solid var(--brand-light)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          <div style={{ width: '100%', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {[
              { city: 'Mumbai', users: 312, pct: 76 },
              { city: 'New York', users: 234, pct: 57 },
              { city: 'Delhi', users: 178, pct: 43 },
              { city: 'London', users: 142, pct: 35 },
            ].map(loc => (
              <div key={loc.city} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-2)', width: '75px' }}>{loc.city}</span>
                <div style={{ flex: 1, height: '4px', borderRadius: '99px', background: 'var(--bg-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${loc.pct}%`, borderRadius: '99px', background: 'var(--brand)' }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace', width: '28px', textAlign: 'right' }}>
                  {loc.users}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Expanded Filterable DAU Traffic Card */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>Daily Active Users (DAU)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                Current DAU: <strong style={{ color: '#3b82f6' }}>{latest?.dau ? latest.dau.toLocaleString() : '—'} users</strong> · Peak: <strong style={{ color: 'var(--success)' }}>1,842 users</strong>
              </p>
            </div>

            {/* Time Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-2)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              {(['7d', '14d', '30d'] as const).map(w => (
                <button
                  key={w}
                  onClick={() => setDauWindow(w)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: dauWindow === w ? 'var(--brand)' : 'transparent',
                    color: dauWindow === w ? '#fff' : 'var(--text-3)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {w.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={290}>
            <AreaChart data={dauChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="dauGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="dau" name="Daily Active Users" stroke="#3b82f6" strokeWidth={2.5} fill="url(#dauGlow)" dot={{ r: 3.5, fill: '#3b82f6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Business and revenue analytics are intentionally rendered once here. */}
      <BusinessPage />

    </div>
    </>
  )
}
