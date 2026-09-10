'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MagicRings } from '@/components/ui/MagicRings'
import { KwudleLogo } from '@/components/ui/KwudleLogo'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [strength, setStrength] = useState(0)
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  useEffect(() => {
    const p = form.password
    let s = 0
    if (p.length >= 8) s++
    if (/[A-Z]/.test(p)) s++
    if (/[0-9]/.test(p)) s++
    if (/[^A-Za-z0-9]/.test(p)) s++
    setStrength(s)
  }, [form.password])

  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981']
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']

  const handleSignup = async (e: any) => {
    if (e?.preventDefault) e.preventDefault()
    if (form.password !== form.confirm && step === 'form') {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, name: form.name, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sign up')
      
      setEmailSent(!!data.emailSent)
      if (data.dev && data.otp) setDevOtp(data.otp)
      
      setStep('otp')
      setResendTimer(60)
      setTimeout(() => otpRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d*$/.test(v)) return
    const n = [...otp]
    n[i] = v.slice(-1)
    setOtp(n)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
    if (n.every(d => d) && n.join('').length === 6) handleVerify(n.join(''))
  }

  const handleVerify = async (code: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invalid code')
      setStep('success')
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: any) {
      setError(err.message)
      setOtp(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #07090e 0%, #0d121f 50%, #07090e 100%)',
    }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Magic Rings Animated Background */}
      <MagicRings
        size={700}
        color="rgba(99,102,241,0.08)"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}
      />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10, animation: 'fadeUp 0.4s ease both' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '18px', marginBottom: '14px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
            animation: 'float 3s ease-in-out infinite',
            color: 'white',
          }}>
            <KwudleLogo size={28} color="white" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>Kwudle</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Observability Platform</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,24,39,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {step === 'form' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>Create account</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                Already have an account? <Link href="/login" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '500' }}>Sign in</Link>
              </p>
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>FULL NAME</label>
                  <input
                    type="text"
                    placeholder="Your name"
                    required
                    value={form.name}
                    onChange={e => setForm(fm => ({ ...fm, name: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>EMAIL</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={form.email}
                    onChange={e => setForm(fm => ({ ...fm, email: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                  {form.password.length > 0 && (
                    <div style={{ marginTop: '6px' }}>
                      <div style={{ display: 'flex', gap: '3px', marginBottom: '3px' }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '99px', background: strength >= i ? strengthColor[strength] : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '11px', color: strengthColor[strength], fontWeight: '600' }}>{strengthLabel[strength]}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>CONFIRM PASSWORD</label>
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    required
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${form.confirm && form.password !== form.confirm ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                  />
                  {form.confirm && form.password !== form.confirm && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Passwords don't match</p>}
                </div>

                {error && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px' }}>
                    <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    color: 'white', fontSize: '15px', fontWeight: '600',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    marginTop: '6px',
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Creating account…
                    </>
                  ) : 'Create account →'}
                </button>
              </form>
            </>
          )}

          {step === 'otp' && (
            <>
              <button
                onClick={() => { setStep('form'); setError(''); setOtp(['', '', '', '', '', '']) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', marginBottom: '20px', padding: 0 }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>Verify your email</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                We sent a 6-digit code to <strong style={{ color: '#f1f5f9' }}>{form.email}</strong>. Please check your inbox.
              </p>

              {devOtp && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24', margin: '0 0 4px' }}>Dev mode — OTP:</p>
                  <p style={{ fontSize: '28px', fontFamily: 'monospace', fontWeight: '700', color: '#fbbf24', margin: 0, letterSpacing: '8px' }}>{devOtp}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'center' }}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus() }}
                    style={{
                      width: '48px', height: '56px', textAlign: 'center', fontSize: '22px', fontWeight: '700',
                      fontFamily: 'monospace', background: d ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${d ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '12px', color: '#f1f5f9', outline: 'none', transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{error}</p>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                {resendTimer > 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Resend code in {resendTimer}s</p>
                ) : (
                  <button
                    onClick={() => handleSignup({})}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '13px', fontWeight: '500' }}
                  >
                    Resend verification code
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', marginBottom: '20px' }}>
                <span style={{ fontSize: '32px', color: '#10b981' }}>✓</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>Account created!</h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>Welcome to Kwudle, {form.name}! Redirecting…</p>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#475569', marginTop: '20px' }}>Kwudle · Passwords encrypted with bcrypt</p>
      </div>
    </div>
  )
}
