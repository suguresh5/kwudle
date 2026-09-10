'use client'
import useSWR from 'swr'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import {
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

// ─── Colour palette ────────────────────────────────────────────────────────────
// ─── Sub-components ────────────────────────────────────────────────────────────

/** Pill toggle group */
function Tabs<T extends string>({ options, value, onChange }:
  { options: { id:T; label:string }[]; value:T; onChange:(v:T)=>void }) {
  return (
    <div style={{ display:'flex',gap:'2px',background:'var(--bg-2)',padding:'3px',borderRadius:'8px',border:'1px solid var(--border)' }}>
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)}
          style={{ padding:'4px 10px',fontSize:'11px',fontWeight:'600',borderRadius:'6px',border:'none',cursor:'pointer',
            background: value===o.id?'var(--brand)':'transparent',
            color: value===o.id?'#fff':'var(--text-3)',
            transition:'all 0.15s' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Stock Panel ───────────────────────────────────────────────────────────────
function StockPanel({ items }: { items: any[] }) {
  if (!items?.length) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100px',color:'var(--success)',fontSize:'13px' }}>
      ✅ All stock levels healthy
    </div>
  )
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
      {items.map((item:any) => {
        const isOut = item.status === 'StockOut'
        return (
          <div key={item.item_id} style={{
            display:'flex',alignItems:'center',gap:'12px',
            padding:'10px 14px',borderRadius:'10px',
            background: isOut?'var(--danger-light)':'var(--warning-light)',
            border:`1px solid ${isOut?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)'}`
          }}>
            <span style={{ fontSize:'20px' }}>{isOut?'🚨':'⚠️'}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'13px',fontWeight:'600',color:'var(--text)' }}>{item.item_id}</div>
              <div style={{ fontSize:'11px',color:'var(--text-2)' }}>
                {item.category} · {item.current_qty} {item.unit} remaining (threshold: {item.threshold})
              </div>
            </div>
            <span className={`badge badge-${isOut?'danger':'warning'}`}>
              {isOut ? 'OUT' : 'LOW'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BusinessPage() {
  const pathname = usePathname()
  const router = useRouter()
  const [revDays, setRevDays] = useState<'7'|'30'|'90'>('30')
  const [itemDays, setItemDays] = useState<'7'|'30'|'90'>('30')

  useEffect(() => {
    if (pathname === '/dashboard/business') router.replace('/dashboard')
  }, [pathname, router])

  const { data: revenue, isLoading: revLoading } = useSWR(['biz_revenue', revDays], () => api.business.revenue({ days: revDays, granularity: 'day' }), { refreshInterval: 30000 })
  const { data: topItems } = useSWR(['biz_topItems', itemDays], () => api.business.topItems({ days: itemDays, limit: '8' }), { refreshInterval: 30000 })
  const { data: stock } = useSWR('biz_stock', () => api.business.stock(), { refreshInterval: 30000 })
  const { data: reviews } = useSWR('biz_reviews', () => api.business.reviews({ days: '7' }), { refreshInterval: 30000 })

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const stockAlerts  = (stock ?? []).length
  const revChart     = (revenue ?? []).map((r:any)=>({
    date: (() => { try { return format(new Date(r.bucket),'MMM d') } catch { return r.bucket } })(),
    revenue: Number(r.revenue||0),
    orders:  Number(r.order_count||0),
  }))
  const reviewSummary  = reviews?.summary ?? {}

  return (
    <div className="fade-up">
      {/* ── Revenue Trend + Top Selling Items ─────────────────────────────── */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px' }}>
      <div className="glass-card" style={{ padding:'24px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px' }}>
          <div>
            <h3 style={{ fontSize:'15px',fontWeight:'700',color:'var(--text)' }}>Revenue Trend</h3>
            <p style={{ fontSize:'12px',color:'var(--text-3)',marginTop:'2px' }}>Daily revenue from OrderPlaced events</p>
          </div>
          <Tabs options={[{id:'7',label:'7d'},{id:'30',label:'30d'},{id:'90',label:'90d'}]}
            value={revDays} onChange={setRevDays as any} />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={revChart} margin={{ top:10,right:10,left:0,bottom:0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill:'var(--text-3)',fontSize:11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill:'var(--text-3)',fontSize:11 }} tickLine={false} axisLine={false} tickFormatter={v=>`₹${v}`} />
            <Tooltip formatter={(v:any,name:any) => [`₹${Number(v).toLocaleString()}`, name]} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5}
              fill="url(#revGrad)" dot={{ r:3,fill:'#10b981' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

        <div className="glass-card" style={{ padding:'24px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px' }}>
            <div>
              <h3 style={{ fontSize:'14px',fontWeight:'700',color:'var(--text)' }}>Top Selling Items</h3>
              <p style={{ fontSize:'12px',color:'var(--text-3)',marginTop:'2px' }}>By revenue contribution</p>
            </div>
            <Tabs options={[{id:'7',label:'7d'},{id:'30',label:'30d'},{id:'90',label:'90d'}]}
              value={itemDays} onChange={setItemDays as any} />
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
            {(topItems ?? []).slice(0,5).map((item:any,i:number) => (
              <div key={item.item_id || i} style={{ display:'flex',alignItems:'center',gap:'10px' }}>
                <span style={{ fontSize:'11px',fontWeight:'700',color:'var(--text-3)',width:'18px' }}>#{i + 1}</span>
                <span style={{ flex:1,fontSize:'13px',fontWeight:'500',color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.item_id || '—'}</span>
                <span style={{ fontSize:'12px',color:'var(--text-2)' }}>{item.order_count} orders</span>
                <span style={{ fontSize:'12px',color:'var(--success)',fontWeight:'600' }}>₹{Number(item.total_revenue || 0).toLocaleString('en-IN', { maximumFractionDigits:0 })}</span>
              </div>
            ))}
            {!topItems?.length && <p style={{ fontSize:'13px',color:'var(--text-3)',textAlign:'center' }}>No sales data yet</p>}
          </div>
        </div>
      </div>

      {/* ── Stock Alerts + Customer Reviews ────────────────────────────────── */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px' }}>
        {/* Stock Alerts */}
        <div className="glass-card" style={{ padding:'24px' }}>
          <h3 style={{ display:'flex',alignItems:'center',gap:'8px',fontSize:'14px',fontWeight:'700',color:'var(--text)',marginBottom:'12px' }}>
            Stock Alerts
            {stockAlerts > 0 && <span className="badge badge-danger">{stockAlerts}</span>}
          </h3>
          <StockPanel items={stock ?? []} />
        </div>

        {/* Recent Reviews */}
        <div className="glass-card" style={{ padding:'24px' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px' }}>
            <h3 style={{ fontSize:'14px',fontWeight:'700',color:'var(--text)' }}>Customer Reviews</h3>
            <div style={{ display:'flex',alignItems:'center',gap:'6px' }}>
              <span style={{ fontSize:'20px',fontWeight:'800',color:'var(--warning)' }}>
                {Number(reviewSummary.avg_rating||0).toFixed(1)}
              </span>
              <span style={{ fontSize:'18px' }}>⭐</span>
            </div>
          </div>
          <div style={{ display:'flex',gap:'12px',marginBottom:'14px' }}>
            <div style={{ flex:1,padding:'10px',borderRadius:'8px',background:'var(--success-light)',textAlign:'center' }}>
              <div style={{ fontSize:'18px',fontWeight:'800',color:'var(--success)' }}>{reviewSummary.positive||0}</div>
              <div style={{ fontSize:'11px',color:'var(--text-3)' }}>Positive</div>
            </div>
            <div style={{ flex:1,padding:'10px',borderRadius:'8px',background:'var(--danger-light)',textAlign:'center' }}>
              <div style={{ fontSize:'18px',fontWeight:'800',color:'var(--danger)' }}>{reviewSummary.negative||0}</div>
              <div style={{ fontSize:'11px',color:'var(--text-3)' }}>Negative</div>
            </div>
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:'8px',maxHeight:'200px',overflowY:'auto' }}>
            {(reviews?.reviews ?? []).slice(0,6).map((r:any,i:number) => (
              <div key={i} style={{ padding:'10px 12px',borderRadius:'8px',background:'var(--bg-2)',border:'1px solid var(--border)' }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px' }}>
                  <span style={{ fontSize:'13px' }}>{'⭐'.repeat(r.rating)}</span>
                  <span style={{ fontSize:'10px',color:'var(--text-3)' }}>
                    {(() => { try { return format(new Date(r.timestamp),'MMM d') } catch { return '' } })()}
                  </span>
                </div>
                {r.comment && <p style={{ fontSize:'12px',color:'var(--text-2)',margin:0,lineHeight:'1.4' }}>&quot;{r.comment}&quot;</p>}
              </div>
            ))}
            {!reviews?.reviews?.length && <span style={{ color:'var(--text-3)',fontSize:'13px' }}>No reviews yet</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
