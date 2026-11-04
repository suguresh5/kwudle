'use client'
import useSWR from 'swr'
import { useState } from 'react'
import { api } from '@/lib/api'
import { format } from 'date-fns'

const DEFAULT = { metric: 'error_rate', operator: 'gt', threshold: '5', window_seconds: '300', notify_channel: 'slack', notify_webhook: '' }

export default function AlertsPage() {
  const { data: rules, isLoading, mutate } = useSWR('alerts', api.alerts.list, { refreshInterval: 30000 })
  const [form, setForm] = useState(DEFAULT)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true)
    try {
      await api.alerts.create({ ...form, threshold: parseFloat(form.threshold), window_seconds: parseInt(form.window_seconds) })
      setForm(DEFAULT); setShowForm(false); mutate()
    } finally { setCreating(false) }
  }

  return (
    <div className="fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.4px' }}>Alert Manager</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: '4px' }}>Threshold rules · 60s poll · 5-min re-fire guard</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white', fontSize: '14px', fontWeight: '600' }}>
          {showForm ? '✕ Cancel' : '+ New Rule'}
        </button>
      </div>

      {showForm && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '20px', borderTop: '2px solid var(--brand)' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--brand)', marginBottom: '20px' }}>New Alert Rule</h3>
          <form onSubmit={handleCreate}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {[{ label: 'Metric', key: 'metric', type: 'text', placeholder: 'error_rate' }, { label: 'Threshold', key: 'threshold', type: 'number', placeholder: '5' }, { label: 'Window (seconds)', key: 'window_seconds', type: 'number', placeholder: '300' }, { label: 'Notify Channel', key: 'notify_channel', type: 'text', placeholder: 'slack' }].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '6px' }}>{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder} className="input-field" value={(form as any)[f.key]} onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))} required />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '6px' }}>Operator</label>
                <select className="input-field" value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} style={{ background: 'var(--bg-2)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', width: '100%', fontSize: '14px' }}>
                  <option value="gt">gt — greater than</option>
                  <option value="lt">lt — less than</option>
                  <option value="eq">eq — equal to</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', marginBottom: '6px' }}>Webhook URL</label>
                <input type="url" placeholder="https://hooks.slack.com/…" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text)', width: '100%', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }} value={form.notify_webhook} onChange={e => setForm(f => ({ ...f, notify_webhook: e.target.value }))} required />
              </div>
            </div>
            <button type="submit" disabled={creating} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: 'white', fontSize: '14px', fontWeight: '600', opacity: creating ? 0.7 : 1 }}>{creating ? 'Creating…' : 'Create Rule'}</button>
          </form>
        </div>
      )}

      <div className="glass-card" style={{ overflow: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid var(--border)', minWidth: '720px' }}>
          {['Metric / Condition', 'Window', 'Channel', 'Last Fired', 'Action'].map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
          ))}
        </div>
        {isLoading ? [...Array(3)].map((_, i) => <div key={i} style={{ padding: '14px 20px' }}><div className="skeleton" style={{ height: '16px' }} /></div>)
          : (rules ?? []).map((rule: any) => (
            <div key={rule.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.1s', minWidth: '720px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`badge ${rule.active ? 'badge-success' : 'badge-warning'}`}>{rule.active ? 'Active' : 'Paused'}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text)' }}>{rule.metric}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{rule.operator}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--warning)' }}>{rule.threshold}</span>
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{rule.window_seconds}s</span>
              <span style={{ fontSize: '13px', color: 'var(--text-2)', textTransform: 'capitalize' }}>{rule.notify_channel}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'monospace' }}>{rule.last_fired_at ? format(new Date(rule.last_fired_at), 'MMM d HH:mm') : 'Never'}</span>
              <button onClick={() => { api.alerts.delete(rule.id); mutate() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--danger)', fontWeight: '500', padding: 0, textAlign: 'left' }}>Revoke</button>
            </div>
          ))}
        {!rules?.length && !isLoading && <p style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' }}>No alert rules configured.</p>}
      </div>
    </div>
  )
}
