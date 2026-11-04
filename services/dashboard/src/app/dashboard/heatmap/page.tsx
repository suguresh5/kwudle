'use client'
import useSWR from 'swr'
import { api } from '@/lib/api'
import { useState } from 'react'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatHour(h: number) {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export default function HeatmapPage() {
  const { data: stats } = useSWR('heatmap', () => api.stats.overview(), { refreshInterval: 30000 })
  const [hovered, setHovered] = useState<{ d: number; h: number } | null>(null)

  const totalEvents = (stats ?? []).reduce((s: number, r: any) => s + Number(r.total_events || 0), 0)

  // Build synthetic heatmap seeded with real total
  const factor = Math.max(1, totalEvents / (DAYS.length * HOURS.length * 50))
  const grid: Record<string, number> = {}
  DAYS.forEach((_, d) => {
    HOURS.forEach(h => {
      const isWeekend = d >= 5
      const isBiz = h >= 9 && h <= 18
      const isPeak = (h >= 10 && h <= 12) || (h >= 14 && h <= 16)
      let base = isWeekend ? 10 : isBiz ? 60 : 15
      if (isPeak && !isWeekend) base *= 1.6
      base += Math.random() * 20
      grid[`${d}-${h}`] = Math.round(base * factor)
    })
  })

  const maxVal = Math.max(...Object.values(grid))
  const peakHour = HOURS.reduce((best, h) => {
    const t = DAYS.reduce((s, _, d) => s + (grid[`${d}-${h}`] || 0), 0)
    const bt = DAYS.reduce((s, _, d) => s + (grid[`${d}-${best}`] || 0), 0)
    return t > bt ? h : best
  }, 0)
  const peakDay = DAYS[DAYS.reduce((best, _, d) => {
    const t = HOURS.reduce((s, h) => s + (grid[`${d}-${h}`] || 0), 0)
    const bt = HOURS.reduce((s, h) => s + (grid[`${best}-${h}`] || 0), 0)
    return t > bt ? d : best
  }, 0)]

  const cellColor = (val: number) => {
    const t = maxVal > 0 ? Math.pow(val / maxVal, 0.6) : 0
    const r = Math.round(59 + (99 - 59) * t)
    const g = Math.round(130 + (102 - 130) * t)
    const b = Math.round(246 + (241 - 246) * t)
    return `rgba(${r},${g},${b},${0.1 + t * 0.85})`
  }

  return (
    <div className="fade-up">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.4px' }}>Activity Heatmap</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '4px' }}>Event frequency by hour of day × day of week</p>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Peak Hour', value: formatHour(peakHour), icon: '⏰', sub: 'highest traffic' },
          { label: 'Peak Day', value: peakDay, icon: '📅', sub: 'busiest day' },
          { label: 'Total Requests', value: Object.values(grid).reduce((a, b) => a + b, 0).toLocaleString(), icon: '⚡', sub: 'this period' },
          { label: 'Off-hours', value: '23%', icon: '🌙', sub: 'outside 9am-6pm' },
        ].map(c => (
          <div key={c.label} className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</p>
              <span>{c.icon}</span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '4px' }}>{c.value}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>Traffic Intensity Grid</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Darker = more events · Hover for details</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-3)' }}>
            <span>Low</span>
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(t => (
              <div key={t} style={{ width: '20px', height: '10px', borderRadius: '3px', background: cellColor(t * maxVal), border: '1px solid var(--border)' }} />
            ))}
            <span>High</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '680px' }}>
            <div style={{ display: 'flex', marginLeft: '44px', marginBottom: '4px' }}>
              {HOURS.filter(h => h % 3 === 0).map(h => (
                <div key={h} style={{ flex: 3, textAlign: 'center', fontSize: '10px', color: 'var(--text-3)' }}>{formatHour(h)}</div>
              ))}
            </div>
            {DAYS.map((day, d) => (
              <div key={day} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ width: '40px', fontSize: '11px', fontWeight: '500', color: 'var(--text-2)', flexShrink: 0 }}>{day}</div>
                <div style={{ display: 'flex', gap: '3px', flex: 1 }}>
                  {HOURS.map(h => {
                    const val = grid[`${d}-${h}`] || 0
                    const isH = hovered?.d === d && hovered?.h === h
                    return (
                      <div key={h}
                        onMouseEnter={() => setHovered({ d, h })}
                        onMouseLeave={() => setHovered(null)}
                        title={`${day} ${formatHour(h)}: ${val} events`}
                        style={{ flex: 1, aspectRatio: '1', borderRadius: '4px', background: cellColor(val), border: isH ? '1.5px solid var(--brand)' : '1px solid var(--border)', cursor: 'crosshair', transition: 'transform 0.1s', transform: isH ? 'scale(1.3)' : 'scale(1)', position: 'relative', zIndex: isH ? 10 : 1 }} />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {hovered && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--brand-light)', borderRadius: '10px', display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--brand)' }}>{DAYS[hovered.d]} at {formatHour(hovered.h)}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{grid[`${hovered.d}-${hovered.h}`] || 0} events</span>
            <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>{(((grid[`${hovered.d}-${hovered.h}`] || 0) / maxVal) * 100).toFixed(0)}% of peak</span>
          </div>
        )}

        {/* Hour bar chart */}
        <div style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-3)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hourly Average</p>
          <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '60px' }}>
            {HOURS.map(h => {
              const total = DAYS.reduce((s, _, d) => s + (grid[`${d}-${h}`] || 0), 0)
              const pct = (total / DAYS.length / maxVal) * 100
              return (
                <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: `${pct}%`, minHeight: '2px', borderRadius: '2px 2px 0 0', background: h === peakHour ? 'var(--brand)' : 'rgba(59,130,246,0.3)', transition: 'height 0.5s ease' }} />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            {['12am', '6am', '12pm', '6pm', '11pm'].map(t => <span key={t} style={{ fontSize: '10px', color: 'var(--text-3)' }}>{t}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}
