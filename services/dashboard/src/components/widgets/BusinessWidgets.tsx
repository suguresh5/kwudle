'use client'
import useSWR from 'swr'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '6e3df3d7f06c3afe830c15c9945dbfd480e65e54dd74d734e4dd12611eeaf1d7'

async function apiFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="metric-card">
      <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        {label}
      </p>
      <p style={{ fontSize: '32px', fontWeight: '800', color: color || 'var(--text)', letterSpacing: '-1px', marginBottom: '4px' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>{sub}</p>}
    </div>
  )
}

function WidgetShell({ title, children, loading }: { title: string; children: React.ReactNode; loading?: boolean }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
        {title}
      </h3>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '20px' }} />)}
        </div>
      ) : children}
    </div>
  )
}

// ─── Widgets ──────────────────────────────────────────────────────────────────

export function OrdersToday() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/revenue?days=1&granularity=day`,
    () => apiFetch('/api/business/revenue?days=1&granularity=day'),
    { refreshInterval: 30000 }
  )
  const today = data?.[0]
  return (
    <MetricTile
      label="Orders Today"
      value={today?.order_count ?? (isLoading ? '…' : '0')}
      sub={today ? `${today.unique_customers} unique customers` : undefined}
      color="var(--brand)"
    />
  )
}

export function RevenueToday() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/revenue?days=1`,
    () => apiFetch('/api/business/revenue?days=1'),
    { refreshInterval: 30000 }
  )
  const today = data?.[0]
  const rev = today?.revenue ?? 0
  return (
    <MetricTile
      label="Revenue Today"
      value={isLoading ? '…' : `₹${Number(rev).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
      sub={today ? `Avg ₹${Number(today.avg_order_value).toFixed(0)} / order` : undefined}
      color="var(--success)"
    />
  )
}

export function TableTurnover() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/table-turnover`,
    () => apiFetch('/api/business/table-turnover'),
    { refreshInterval: 60000 }
  )
  const avg = data?.[0]?.avg_occupancy_minutes
  return (
    <MetricTile
      label="Avg Table Turnover"
      value={isLoading ? '…' : avg ? `${Number(avg).toFixed(0)} min` : 'N/A'}
      sub="Average time a table is occupied"
      color={avg > 45 ? 'var(--warning)' : 'var(--success)'}
    />
  )
}

export function TopItems() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/top-items?limit=5`,
    () => apiFetch('/api/business/top-items?limit=5'),
    { refreshInterval: 60000 }
  )
  return (
    <WidgetShell title="Top Items" loading={isLoading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {(data ?? []).slice(0, 5).map((item: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-3)', width: '18px' }}>#{i + 1}</span>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_id || '—'}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{item.order_count} orders</span>
            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '600' }}>
              ₹{Number(item.total_revenue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
        {!isLoading && !data?.length && (
          <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No sales data yet</p>
        )}
      </div>
    </WidgetShell>
  )
}

export function StockAlerts() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/stock`,
    () => apiFetch('/api/business/stock'),
    { refreshInterval: 30000 }
  )
  const alerts = data ?? []
  return (
    <WidgetShell title={`Stock Alerts ${alerts.length ? `(${alerts.length})` : ''}`} loading={isLoading}>
      {alerts.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--success)', textAlign: 'center' }}>✓ All stock levels healthy</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.slice(0, 5).map((a: any, i: number) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: '8px',
              background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{a.item_id}</span>
              <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: '700' }}>
                {a.current_qty} {a.unit} left
              </span>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  )
}

export function PaymentMethods() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/revenue?days=7`,
    () => apiFetch('/api/business/revenue?days=7'),
    { refreshInterval: 60000 }
  )
  // Payment method breakdown comes from a separate endpoint if available, else show revenue trend
  const rows = data ?? []
  return (
    <WidgetShell title="Payment Methods (7d)" loading={isLoading}>
      {rows.length === 0
        ? <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No payment data yet</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.slice(0, 5).map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-2)' }}>
                <span>{new Date(r.bucket).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</span>
                <span style={{ color: 'var(--success)', fontWeight: '600' }}>₹{Number(r.revenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}
          </div>
      }
    </WidgetShell>
  )
}

export function Reviews() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/reviews`,
    () => apiFetch('/api/business/reviews'),
    { refreshInterval: 120000 }
  )
  const avg = data?.avg_rating
  const reviews = data?.reviews ?? []
  return (
    <WidgetShell title={`Reviews ${avg ? `(${Number(avg).toFixed(1)} ★)` : ''}`} loading={isLoading}>
      {reviews.length === 0
        ? <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No reviews yet</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reviews.slice(0, 3).map((r: any, i: number) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: '700' }}>{'★'.repeat(r.rating || 0)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.user_id?.slice(0, 8)}</span>
                </div>
                {r.comment && <p style={{ fontSize: '12px', color: 'var(--text-2)', margin: 0 }}>{r.comment}</p>}
              </div>
            ))}
          </div>
      }
    </WidgetShell>
  )
}

export function TopCategories() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/top-items?limit=5`,
    () => apiFetch('/api/business/top-items?limit=5'),
    { refreshInterval: 60000 }
  )
  // Group by category client-side
  const categoryMap: Record<string, number> = {}
  for (const item of data ?? []) {
    const cat = item.category || 'Uncategorised'
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.order_count || 0)
  }
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <WidgetShell title="Top Categories" loading={isLoading}>
      {categories.length === 0
        ? <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No category data yet</p>
        : categories.map(([cat, cnt], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--text)' }}>{cat}</span>
              <div style={{ width: '80px', height: '4px', borderRadius: '99px', background: 'var(--bg-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(cnt / (categories[0][1] || 1)) * 100}%`, background: 'var(--brand)', borderRadius: '99px' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', minWidth: '30px', textAlign: 'right' }}>{cnt}</span>
            </div>
          ))
      }
    </WidgetShell>
  )
}

export function FootfallTrend() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/revenue?days=7&granularity=day`,
    () => apiFetch('/api/business/revenue?days=7&granularity=day'),
    { refreshInterval: 60000 }
  )
  return (
    <WidgetShell title="Footfall (7d, unique customers)" loading={isLoading}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(data ?? []).slice(0, 7).map((r: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-2)' }}>{new Date(r.bucket).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</span>
            <span style={{ color: 'var(--brand)', fontWeight: '600' }}>{r.unique_customers} visitors</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  )
}

export function FunnelConversion() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/stats/funnel`,
    () => apiFetch('/api/stats/funnel'),
    { refreshInterval: 60000 }
  )
  const steps = data?.steps ?? []
  return (
    <WidgetShell title="Funnel Conversion" loading={isLoading}>
      {steps.length === 0
        ? <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No funnel data yet</p>
        : steps.map((s: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ width: '90px', fontSize: '12px', color: 'var(--text-3)' }}>{s.event_type}</span>
              <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'var(--bg-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(s.count / (steps[0]?.count || 1)) * 100}%`, background: 'var(--brand)', borderRadius: '99px' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-2)', minWidth: '50px', textAlign: 'right' }}>{s.count}</span>
            </div>
          ))
      }
    </WidgetShell>
  )
}

export function MRRTrend() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/saas`,
    () => apiFetch('/api/business/saas'),
    { refreshInterval: 60000 }
  )
  const mrr = data?.mrr ?? 0
  return (
    <MetricTile
      label="MRR"
      value={isLoading ? '…' : `$${Number(mrr).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
      sub="Monthly Recurring Revenue"
      color="var(--success)"
    />
  )
}

export function ChurnRate() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/saas`,
    () => apiFetch('/api/business/saas'),
    { refreshInterval: 60000 }
  )
  const churn = data?.churn_rate ?? 0
  return (
    <MetricTile
      label="Churn Rate"
      value={isLoading ? '…' : `${Number(churn).toFixed(1)}%`}
      sub="30-day subscriber churn"
      color={churn > 10 ? 'var(--danger)' : churn > 5 ? 'var(--warning)' : 'var(--success)'}
    />
  )
}

export function FeatureAdoption() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/business/saas`,
    () => apiFetch('/api/business/saas'),
    { refreshInterval: 60000 }
  )
  const features = data?.feature_adoption ?? []
  return (
    <WidgetShell title="Feature Adoption" loading={isLoading}>
      {features.length === 0
        ? <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>No FeatureUsed events yet</p>
        : features.slice(0, 5).map((f: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text)', fontWeight: '500' }}>{f.feature_name}</span>
              <span style={{ color: 'var(--brand)', fontWeight: '600' }}>{f.usage_count} uses</span>
            </div>
          ))
      }
    </WidgetShell>
  )
}

export function ActiveSessions() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/stats/sessions`,
    () => apiFetch('/api/stats/sessions'),
    { refreshInterval: 15000 }
  )
  return (
    <MetricTile
      label="Active Sessions"
      value={isLoading ? '…' : data?.active_sessions ?? 0}
      sub="Open sessions right now"
      color="var(--brand)"
    />
  )
}

export function ErrorRate() {
  const { data, isLoading } = useSWR(
    `${API_BASE}/api/stats/error-rate`,
    () => apiFetch('/api/stats/error-rate'),
    { refreshInterval: 15000 }
  )
  const rate = data?.error_rate_pct ?? 0
  return (
    <MetricTile
      label="Error Rate"
      value={isLoading ? '…' : `${Number(rate).toFixed(2)}%`}
      sub="Last 5 minutes"
      color={rate > 5 ? 'var(--danger)' : rate > 1 ? 'var(--warning)' : 'var(--success)'}
    />
  )
}

// ─── Widget registry ──────────────────────────────────────────────────────────
// Maps widget ID (from DASHBOARD_TEMPLATES) to its React component.
export const WIDGET_REGISTRY: Record<string, React.ComponentType> = {
  OrdersToday,
  RevenueToday,
  TableTurnover,
  TopItems,
  StockAlerts,
  PaymentMethods,
  Reviews,
  TopCategories,
  FootfallTrend,
  FunnelConversion,
  MRRTrend,
  ChurnRate,
  FeatureAdoption,
  ActiveSessions,
  ErrorRate,
}
