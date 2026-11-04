'use client'
import { BorderGlow } from './BorderGlow'

// ─── SVG Icons for Metric Cards ───────────────────────────────────────────────
const METRIC_ICONS: Record<string, React.ReactNode> = {
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  events: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  rocket: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    </svg>
  ),
  coffee: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  ),
  plate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  currency: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  cart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  ),
  userPlus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="23" y1="11" x2="17" y2="11"/>
    </svg>
  ),
  repeat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <polyline points="7 23 3 19 7 15"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
}

// Glow color map
const GLOW_COLORS: Record<string, string> = {
  users: 'rgba(99,102,241,0.5)',
  events: 'rgba(245,158,11,0.5)',
  shield: 'rgba(16,185,129,0.5)',
  clock: 'rgba(59,130,246,0.5)',
  rocket: 'rgba(139,92,246,0.5)',
  coffee: 'rgba(245,158,11,0.5)',
  plate: 'rgba(34,197,94,0.5)',
  chart: 'rgba(59,130,246,0.5)',
  currency: 'rgba(16,185,129,0.5)',
  cart: 'rgba(59,130,246,0.5)',
  userPlus: 'rgba(139,92,246,0.5)',
  repeat: 'rgba(16,185,129,0.5)',
}

export function MetricCard({ label, value, sub, trend, trendValue, icon, loading }: any) {
  if (loading) return (
    <div className="metric-card">
      <div className="skeleton" style={{ height:'12px',width:'60%',marginBottom:'12px' }}/>
      <div className="skeleton" style={{ height:'32px',width:'40%',marginBottom:'8px' }}/>
      <div className="skeleton" style={{ height:'10px',width:'50%' }}/>
    </div>
  )

  const iconKey = typeof icon === 'string' ? icon : 'chart'
  const svgIcon = METRIC_ICONS[iconKey]
  const glowColor = GLOW_COLORS[iconKey] || 'rgba(99,102,241,0.5)'
  const iconColorMap: Record<string, string> = {
    users: '#6366f1', events: '#f59e0b', shield: '#10b981', clock: '#3b82f6',
    rocket: '#8b5cf6', coffee: '#f59e0b', plate: '#22c55e', chart: '#3b82f6',
    currency: '#10b981', cart: '#3b82f6', userPlus: '#8b5cf6', repeat: '#10b981',
  }
  const iconColor = iconColorMap[iconKey] || '#3b82f6'

  return (
    <BorderGlow glowColor={glowColor}>
      <div className="fade-up" style={{ padding: '20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px', alignItems:'center' }}>
          <p style={{ fontSize:'11px', fontWeight:'600', color:'var(--text-3)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
            {label}
          </p>
          {svgIcon && (
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: `${iconColor}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: iconColor,
            }}>
              {svgIcon}
            </div>
          )}
        </div>
        <p style={{ fontSize:'28px', fontWeight:'700', color:'var(--text)', letterSpacing:'-0.04em', lineHeight:1.05, marginBottom:'8px', fontVariantNumeric:'tabular-nums' }}>
          {value}
        </p>
        {(sub || trendValue) && (
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            {trendValue && (
              <span style={{
                fontSize:'11px', fontWeight:'600', padding:'1px 6px', borderRadius:'4px',
                background: trend==='up' ? 'var(--success-light)' : trend==='down' ? 'var(--danger-light)' : 'var(--bg-2)',
                color: trend==='up' ? 'var(--success)' : trend==='down' ? 'var(--danger)' : 'var(--text-3)',
              }}>
                {trend==='up' ? '↑' : trend==='down' ? '↓' : '→'} {trendValue}
              </span>
            )}
            {sub && <span style={{ fontSize:'12px', color:'var(--text-3)' }}>{sub}</span>}
          </div>
        )}
      </div>
    </BorderGlow>
  )
}
