'use client'
import useSWR from 'swr'
import { api } from '@/lib/api'

const STEPS = [
  { key: 'PageView', label: 'Page View', icon: '👁️', color: '#3b82f6' },
  { key: 'Login', label: 'Sign Up', icon: '👤', color: '#6366f1' },
  { key: 'AddToCart', label: 'Add to Cart', icon: '🛒', color: '#8b5cf6' },
  { key: 'Checkout', label: 'Checkout', icon: '💳', color: '#a855f7' },
  { key: 'Purchase', label: 'Purchase', icon: '✅', color: '#10b981' },
]

export default function FunnelPage() {
  const { data: stats, isLoading } = useSWR('funnel', () => api.stats.overview(), { refreshInterval: 30000 })

  const counts = (stats ?? []).reduce((acc: any, s: any) => {
    acc[s.event_type] = (acc[s.event_type] || 0) + Number(s.total_events)
    return acc
  }, {})

  const top = counts['PageView'] || 1
  const funnelData = STEPS.map((step, i) => {
    const count = counts[step.key] || 0
    const prev = i === 0 ? count : (counts[STEPS[i - 1].key] || 1)
    return {
      ...step, count,
      overall: top > 0 ? ((count / top) * 100).toFixed(1) : '0',
      stepRate: prev > 0 ? ((count / prev) * 100).toFixed(1) : '0',
    }
  })

  const finalRate = funnelData[funnelData.length - 1]?.overall || '0'
  const biggestDrop = funnelData.slice(0, -1).reduce((best: { from: string; to: string; drop: number }, step, i) => {
    const drop = Math.max(0, 100 - Number(funnelData[i + 1].stepRate))
    return drop > best.drop ? { from: step.label, to: funnelData[i + 1].label, drop } : best
  }, { from: 'No data', to: '', drop: 0 })

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', color: 'var(--brand)', textTransform: 'uppercase', marginBottom: '8px' }}>Conversion workspace</p>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.6px' }}>Funnel Analysis</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '6px' }}>See where intent becomes action and where momentum fades.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '14px', background: 'var(--brand-light)', border: '1px solid rgba(59,130,246,0.25)' }}>
          <div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Visit to purchase</div><div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--brand)' }}>{finalRate}%</div></div>
          <div style={{ width: '1px', height: '34px', background: 'var(--border)' }} />
          <div><div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Largest drop</div><div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--danger)' }}>{biggestDrop.drop.toFixed(1)}%</div></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.85fr)', gap: '16px', marginBottom: '20px' }}>
        {/* Visual funnel bars */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div><h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>Journey health</h3><p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>Relative volume at each stage</p></div>
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Live · 30s refresh</span>
          </div>
          {isLoading
            ? [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: '48px', marginBottom: '12px', borderRadius: '10px' }} />)
            : funnelData.map((step, i) => (
              <div key={step.key} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>{step.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{step.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'monospace' }}>{step.count.toLocaleString()} users</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: step.color, minWidth: '42px', textAlign: 'right' }}>{step.overall}%</span>
                  </div>
                </div>
                <div style={{ height: '12px', borderRadius: '99px', background: 'var(--bg-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '99px', width: `${step.overall}%`, background: step.color, transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
                </div>
                {i < funnelData.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', paddingLeft: '24px' }}>
                    <div style={{ width: '1px', height: '12px', background: 'var(--border-strong)', marginLeft: '8px' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {funnelData[i + 1].stepRate}% continue
                      <span style={{ color: 'var(--danger)', marginLeft: '8px' }}>{(100 - Number(funnelData[i + 1].stepRate)).toFixed(1)}% drop off</span>
                    </span>
                  </div>
                )}
              </div>
            ))}
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--brand-light)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>Overall conversion rate</span>
            <span style={{ fontSize: '24px', fontWeight: '800', color: 'var(--brand)' }}>{finalRate}%</span>
          </div>
        </div>

        {/* Drop-off summary: complementary to the funnel bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-card" style={{ padding: '22px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Focus area</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text)', marginBottom: '8px' }}>{biggestDrop.from} <span style={{ color: 'var(--text-3)' }}>→</span> {biggestDrop.to}</div>
            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.55', marginBottom: '12px' }}>This transition loses the most people. Start your investigation here.</p>
            {funnelData.slice(0, -1).map((step, i) => {
              const next = funnelData[i + 1]
              const dropOff = Math.max(0, 100 - Number(next.stepRate))
              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < funnelData.length - 2 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dropOff > 50 ? 'var(--danger)' : 'var(--warning)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-2)' }}>{step.label} to {next.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: dropOff > 50 ? 'var(--danger)' : 'var(--warning)' }}>{dropOff.toFixed(1)}% drop</span>
                </div>
              )
            })}
          </div>
          <div className="glass-card" style={{ padding: '22px', flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Stage performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {funnelData.slice(1).map(step => <div key={step.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{step.label} conversion</span><span style={{ fontSize: '13px', fontWeight: '800', color: Number(step.stepRate) >= 50 ? 'var(--success)' : 'var(--warning)' }}>{step.stepRate}%</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
