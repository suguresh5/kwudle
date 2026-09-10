'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ─────────────────────────────────────────────────────────────────────
type BizType = 'cafe' | 'restaurant' | 'retail' | 'startup' | null
type Step = 1 | 2 | 3 | 4

const BIZ_OPTIONS: { id: BizType; icon: string; label: string; desc: string }[] = [
  { id: 'cafe',       icon: '☕', label: 'Cafe / Coffee Shop', desc: 'Track orders, stock, peak hours & loyalty' },
  { id: 'restaurant', icon: '🍽️', label: 'Restaurant',         desc: 'Table turnover, kitchen timing, reviews' },
  { id: 'retail',     icon: '🏪', label: 'Retail / Shop',       desc: 'Inventory, sales, customer footfall' },
  { id: 'startup',    icon: '🚀', label: 'SaaS / Startup',      desc: 'Funnels, MRR, churn, feature adoption' },
]

// ─── Event Snippet Generators ──────────────────────────────────────────────────
function getSnippets(biz: BizType, apiKey: string) {
  const base = `curl -X POST http://localhost:8080/v1/events \\\n  -H 'Authorization: Bearer ${apiKey}' \\\n  -H 'Content-Type: application/json' \\\n  -d`

  if (biz === 'cafe' || biz === 'restaurant') {
    return [
      {
        label: '🛒 Record an Order',
        lang: 'bash',
        code: `${base} '{"event_type":"OrderPlaced","user_id":"customer_123",
  "properties":{"order_id":"ord_001","table_id":"T3",
    "amount":450,"item_id":"Cappuccino",
    "category":"Beverage","location_id":"main_branch"}}'`,
      },
      {
        label: '💳 Record Payment',
        lang: 'bash',
        code: `${base} '{"event_type":"PaymentProcessed","user_id":"customer_123",
  "properties":{"order_id":"ord_001","amount":450,
    "payment_method":"upi","location_id":"main_branch"}}'`,
      },
      {
        label: '🪑 Table Occupied',
        lang: 'bash',
        code: `${base} '{"event_type":"TableOccupied",
  "properties":{"table_id":"T3","party_size":2,
    "location_id":"main_branch"}}'`,
      },
      {
        label: '⚠️ Low Stock Alert',
        lang: 'bash',
        code: `${base} '{"event_type":"StockLow",
  "properties":{"item_id":"Oat Milk","current_qty":1.5,
    "threshold":5,"unit":"litres","category":"Dairy",
    "location_id":"main_branch"}}'`,
      },
      {
        label: '⭐ Customer Review',
        lang: 'bash',
        code: `${base} '{"event_type":"ReviewSubmitted","user_id":"customer_123",
  "properties":{"order_id":"ord_001","rating":5,
    "comment":"Amazing experience!","location_id":"main_branch"}}'`,
      },
    ]
  }

  if (biz === 'retail') {
    return [
      {
        label: '🛒 Record a Sale',
        lang: 'bash',
        code: `${base} '{"event_type":"OrderPlaced","user_id":"shopper_001",
  "properties":{"order_id":"sale_001","amount":1299,
    "item_id":"Blue Denim Jeans","category":"Clothing",
    "location_id":"store_01"}}'`,
      },
      {
        label: '📦 Stock Update',
        lang: 'bash',
        code: `${base} '{"event_type":"StockLow",
  "properties":{"item_id":"Blue Denim Jeans","current_qty":3,
    "threshold":10,"unit":"units","category":"Clothing",
    "location_id":"store_01"}}'`,
      },
      {
        label: '🏅 Loyalty Points',
        lang: 'bash',
        code: `${base} '{"event_type":"LoyaltyEarned","user_id":"shopper_001",
  "properties":{"loyalty_points":130,"tier":"silver",
    "location_id":"store_01"}}'`,
      },
    ]
  }

  // startup
  return [
    {
      label: '🆕 New Signup',
      lang: 'bash',
      code: `${base} '{"event_type":"Signup","user_id":"user_abc123",
  "properties":{"plan":"free","source":"google_ads"}}'`,
    },
    {
      label: '🎯 Trial Started',
      lang: 'bash',
      code: `${base} '{"event_type":"TrialStarted","user_id":"user_abc123",
  "properties":{"trial_days":14,"plan":"pro"}}'`,
    },
    {
      label: '💳 Subscription',
      lang: 'bash',
      code: `${base} '{"event_type":"Subscribed","user_id":"user_abc123",
  "properties":{"plan":"pro","mrr_delta":999}}'`,
    },
    {
      label: '🔧 Feature Used',
      lang: 'bash',
      code: `${base} '{"event_type":"FeatureUsed","user_id":"user_abc123",
  "properties":{"feature_name":"export_report"}}'`,
    },
    {
      label: '💰 Invoice Paid',
      lang: 'bash',
      code: `${base} '{"event_type":"InvoicePaid","user_id":"user_abc123",
  "properties":{"mrr_delta":999,"plan":"pro"}}'`,
    },
  ]
}

// ─── Copy Button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      padding: '4px 10px', fontSize: '11px', fontWeight: '600',
      borderRadius: '6px', border: '1px solid var(--border)',
      background: copied ? 'var(--success-light)' : 'var(--bg-2)',
      color: copied ? 'var(--success)' : 'var(--text-2)',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ─── Step indicators ───────────────────────────────────────────────────────────
function StepDot({ n, current }: { n: number; current: Step }) {
  const done = n < current
  const active = n === current
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: '700',
        background: done ? 'var(--success)' : active ? 'var(--brand)' : 'var(--bg-2)',
        color: done || active ? '#fff' : 'var(--text-3)',
        border: `2px solid ${active ? 'var(--brand)' : 'transparent'}`,
        transition: 'all 0.2s',
      }}>
        {done ? '✓' : n}
      </div>
    </div>
  )
}

// ─── Live Event Pulse ──────────────────────────────────────────────────────────
function LivePulse({ apiKey }: { apiKey: string }) {
  const [events, setEvents] = useState<{ type: string; time: string }[]>([])
  const [checking, setChecking] = useState(false)

  const sendTestEvent = async () => {
    setChecking(true)
    try {
      await fetch('http://localhost:8080/v1/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'OrderPlaced',
          user_id: 'onboarding_test',
          properties: {
            order_id: `test_${Date.now()}`,
            amount: 99,
            item_id: 'Test Item',
            location_id: 'onboarding',
          },
        }),
      })
      setEvents(prev => [{ type: 'OrderPlaced ✓', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)])
    } catch {
      setEvents(prev => [{ type: 'Connection failed — is Docker running?', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)])
    } finally {
      setChecking(false)
    }
  }

  return (
    <div>
      <button onClick={sendTestEvent} disabled={checking}
        style={{
          padding: '10px 20px', borderRadius: '10px', border: 'none',
          background: 'var(--brand)', color: '#fff', fontWeight: '700', fontSize: '14px',
          cursor: checking ? 'not-allowed' : 'pointer', opacity: checking ? 0.7 : 1,
          transition: 'all 0.15s', marginBottom: '16px',
        }}>
        {checking ? '⏳ Sending…' : '🚀 Send Test Event'}
      </button>
      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {events.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '8px 12px', borderRadius: '8px',
              background: i === 0 ? 'var(--success-light)' : 'var(--bg-2)',
              border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              animation: i === 0 ? 'fadeUp 0.3s ease both' : 'none',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === 0 ? 'var(--success)' : 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', flex: 1 }}>{e.type}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>{e.time}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Onboarding Component ─────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [bizType, setBizType] = useState<BizType>(null)
  const [bizName, setBizName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [activeSnippet, setActiveSnippet] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const snippets = bizType ? getSnippets(bizType, apiKey || 'YOUR_API_KEY') : []

  const provisionTenant = async () => {
    setGenerating(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch('http://localhost:8080/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bizName || 'My Business', tier: 'pro' }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.api_key) setApiKey(data.api_key)
      else setApiKey('sk_demo_' + Math.random().toString(36).slice(2, 18))
    } catch {
      setApiKey('sk_demo_' + Math.random().toString(36).slice(2, 18))
    } finally {
      window.clearTimeout(timeout)
      setGenerating(false)
      setStep(3)
    }
  }

  // Called at the end of Step 4 to persist business type and redirect
  const completeOnboarding = async () => {
    if (!bizType) return
    setSaving(true)
    try {
      await fetch('/api/auth/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: bizType }),
      })
    } catch {
      // Non-fatal — user still proceeds to dashboard
    } finally {
      setSaving(false)
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 112px)', padding: '8px 0 48px', background: 'radial-gradient(circle at 50% 0%, var(--brand-light), transparent 42%)' }}>
      <div className="fade-up" style={{ maxWidth: '760px', margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '36px', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
          background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(99,102,241,0.35)',
        }}>
          <span style={{ fontSize: '24px' }}>◈</span>
        </div>
        <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Welcome to Kwudle Business
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-2)' }}>
          Set up your analytics in 4 steps — takes less than 2 minutes
        </p>
      </div>

      {/* ── Step Indicator ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '36px' }}>
        {[1, 2, 3, 4].map((n, i) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <StepDot n={n} current={step} />
            {i < 3 && (
              <div style={{ width: '48px', height: '2px', borderRadius: '99px',
                background: n < step ? 'var(--success)' : 'var(--border)', transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Choose Business Type ─────────────────────────────────── */}
      {step === 1 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>
            Step 1 — What kind of business are you?
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            We'll pre-configure your dashboards, alerts, and SDK snippets based on your choice.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            {BIZ_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setBizType(opt.id)}
                style={{
                  padding: '20px', borderRadius: '14px', border: '2px solid',
                  borderColor: bizType === opt.id ? 'var(--brand)' : 'var(--border)',
                  background: bizType === opt.id ? 'var(--brand-light)' : 'var(--bg-2)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  transform: bizType === opt.id ? 'scale(1.02)' : 'scale(1)',
                }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{opt.icon}</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>{opt.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => bizType && setStep(2)} disabled={!bizType}
            style={{
              width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
              background: bizType ? 'var(--brand)' : 'var(--bg-2)',
              color: bizType ? '#fff' : 'var(--text-3)',
              fontSize: '14px', fontWeight: '700', cursor: bizType ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}>
            Continue →
          </button>
        </div>
      )}

      {/* ── Step 2: Name + API Key ────────────────────────────────────────── */}
      {step === 2 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '22px' }}>{BIZ_OPTIONS.find(b => b.id === bizType)?.icon}</span>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)' }}>
              Step 2 — Name your business
            </h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            We'll create your tenant account and generate a secure API key.
          </p>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', display: 'block', marginBottom: '8px' }}>
              Business Name
            </label>
            <input
              value={bizName}
              onChange={e => setBizName(e.target.value)}
              placeholder={bizType === 'startup' ? 'e.g. Acme SaaS Inc.' : 'e.g. Brew & Co Cafe'}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '10px',
                border: '1px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text)', fontSize: '14px', outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>
          <div style={{ padding: '14px', borderRadius: '10px', background: 'var(--brand-light)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', color: 'var(--brand)', margin: 0 }}>
              ℹ️ This will call <code style={{ fontFamily: 'monospace' }}>POST /admin/tenants</code> on your local server.
              Make sure Docker is running first (<code style={{ fontFamily: 'monospace' }}>docker compose up -d</code>).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(1)}
              style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={provisionTenant} disabled={generating}
              style={{
                flex: 1, padding: '13px', borderRadius: '10px', border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: '14px', fontWeight: '700', cursor: generating ? 'not-allowed' : 'pointer',
                opacity: generating ? 0.8 : 1, transition: 'all 0.15s',
              }}>
              {generating ? '⏳ Generating…' : '🔑 Generate API Key →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: SDK Snippets ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>
            Step 3 — Start sending events
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '8px' }}>
            Your API key is ready. Copy and run these snippets to send your first events.
          </p>

          {/* API Key display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: '600', flexShrink: 0 }}>API KEY</span>
            <code style={{ flex: 1, fontSize: '12px', color: 'var(--success)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {apiKey}
            </code>
            <CopyButton text={apiKey} />
          </div>

          {/* Snippet tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {snippets.map((s, i) => (
              <button key={i} onClick={() => setActiveSnippet(i)}
                style={{
                  padding: '5px 12px', fontSize: '11px', fontWeight: '600', borderRadius: '8px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                  borderColor: activeSnippet === i ? 'var(--brand)' : 'var(--border)',
                  background: activeSnippet === i ? 'var(--brand-light)' : 'var(--bg-2)',
                  color: activeSnippet === i ? 'var(--brand)' : 'var(--text-2)',
                }}>
                {s.label}
              </button>
            ))}
          </div>

          {snippets[activeSnippet] && (
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
                <CopyButton text={snippets[activeSnippet].code} />
              </div>
              <pre style={{
                padding: '16px', paddingRight: '70px', borderRadius: '10px',
                background: '#0f172a', color: '#94a3b8',
                fontSize: '11.5px', fontFamily: 'JetBrains Mono, monospace',
                lineHeight: '1.7', overflowX: 'auto', margin: 0,
                border: '1px solid rgba(255,255,255,0.06)',
              }}>{snippets[activeSnippet].code}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setStep(2)}
              style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              ← Back
            </button>
            <button onClick={() => setStep(4)}
              style={{ flex: 1, padding: '13px', borderRadius: '10px', border: 'none', background: 'var(--brand)', color: '#fff', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
              Next — Verify Live Data →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Live Verify ───────────────────────────────────────────── */}
      {step === 4 && (
        <div className="glass-card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', marginBottom: '6px' }}>
            Step 4 — Verify your first live event
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '24px' }}>
            Click the button below to fire a test event and confirm the pipeline is working end-to-end.
          </p>

          <LivePulse apiKey={apiKey} />

          <div style={{
            marginTop: '28px', padding: '20px', borderRadius: '12px',
            background: 'linear-gradient(135deg,var(--success-light),var(--brand-light))',
            border: '1px solid rgba(16,185,129,0.3)',
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', marginBottom: '16px' }}>
              🎉 You're all set!
            </h3>
            <button
              onClick={completeOnboarding}
              disabled={saving}
              style={{
                width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontSize: '15px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.8 : 1, transition: 'all 0.15s',
              }}
            >
              {saving ? '⏳ Saving…' : '🚀 Go to My Dashboard →'}
            </button>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', textAlign: 'center', marginTop: '10px' }}>
              Your {bizType} dashboard, prebuilt alerts, and API key are ready.
            </p>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
