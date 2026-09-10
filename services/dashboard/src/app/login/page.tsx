'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MagicRings } from '@/components/ui/MagicRings'
import { KwudleLogo } from '@/components/ui/KwudleLogo'

type AuthMode = 'signin' | 'forgot' | 'reset' | 'reset-success'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [showPass, setShowPass] = useState(false)

  // Forgot password & reset state
  const [forgotEmail, setForgotEmail] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPass, setShowNewPass] = useState(false)
  const [devOtp, setDevOtp] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  // Normal Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Authentication failed')
      window.location.href = data.redirect || '/dashboard'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Request Reset OTP
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail || form.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send reset code')

      if (data.dev && data.otp) setDevOtp(data.otp)
      setMode('reset')
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
  }

  // Submit Password Reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const otpCode = otp.join('')
    if (otpCode.length !== 6) {
      setError('Please enter the full 6-digit verification code')
      return
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail || form.email,
          otp: otpCode,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reset password')

      setMode('reset-success')
      setSuccessMsg(data.message || 'Password reset successfully!')
      setForm(f => ({ ...f, email: forgotEmail || form.email, password: '' }))
      setTimeout(() => {
        setMode('signin')
        setError('')
      }, 2500)
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
        @keyframes pulse-glow{0%,100%{opacity:0.4}50%{opacity:0.8}} .orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;animation:pulse-glow 4s ease-in-out infinite}
      `}</style>

      {/* Background effects */}
      <div className="orb" style={{ width: '500px', height: '500px', top: '-200px', right: '-150px', background: 'rgba(99,102,241,0.15)' }} />
      <div className="orb" style={{ width: '400px', height: '400px', bottom: '-150px', left: '-100px', background: 'rgba(59,130,246,0.12)', animationDelay: '2s' }} />

      {/* MagicRings behind the card */}
      <MagicRings
        size={700}
        color="rgba(99,102,241,0.08)"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1 }}
      />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10, animation: 'fadeUp 0.4s ease both' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '60px', height: '60px', borderRadius: '18px', marginBottom: '14px',
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
            animation: 'float 3s ease-in-out infinite',
            color: 'white',
          }}>
            <KwudleLogo size={28} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.5px' }}>Kwudle</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            {mode === 'signin' ? 'Welcome back' : 'Account Recovery'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,24,39,0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '34px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>

          {/* ── MODE 1: SIGN IN ─────────────────────────────────────── */}
          {mode === 'signin' && (
            <>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>Sign in</h2>
              <p style={{ fontSize: '13.5px', color: '#64748b', marginBottom: '24px' }}>
                New to Kwudle? <Link href="/signup" style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: '500' }}>Create account</Link>
              </p>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>EMAIL</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoFocus
                    autoComplete="off"
                    value={form.email}
                    onChange={e => {
                      setForm(fm => ({ ...fm, email: e.target.value }))
                      setForgotEmail(e.target.value)
                    }}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                      color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    }}
                    onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', letterSpacing: '0.04em' }}>PASSWORD</label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setError('')
                        setForgotEmail(form.email)
                      }}
                      style={{
                        background: 'none', border: 'none', color: '#60a5fa',
                        fontSize: '12px', cursor: 'pointer', padding: 0, fontWeight: '500',
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="Your password"
                      required
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(fm => ({ ...fm, password: e.target.value }))}
                      style={{
                        width: '100%', padding: '11px 42px 11px 14px', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                        color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                      }}
                      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.15)' }}
                      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                    >
                      {showPass ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
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
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
                    color: 'white', fontSize: '15px', fontWeight: '600',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                    opacity: loading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Signing in…
                    </>
                  ) : 'Sign in →'}
                </button>
              </form>
            </>
          )}

          {/* ── MODE 2: FORGOT PASSWORD REQUEST ─────────────────────── */}
          {mode === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => { setMode('signin'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', marginBottom: '16px', padding: 0 }}
              >
                ← Back to Sign in
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>Reset password</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '22px', lineHeight: '1.5' }}>
                Enter your account email to receive a 6-digit verification code.
              </p>

              <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', letterSpacing: '0.04em' }}>EMAIL</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    style={{
                      width: '100%', padding: '11px 14px', borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                      color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
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
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
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
                      Sending code…
                    </>
                  ) : 'Send reset code →'}
                </button>
              </form>
            </>
          )}

          {/* ── MODE 3: ENTER OTP & NEW PASSWORD ────────────────────── */}
          {mode === 'reset' && (
            <>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError('') }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '13px', marginBottom: '16px', padding: 0 }}
              >
                ← Back
              </button>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '6px' }}>Set new password</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                We sent a 6-digit code to <strong style={{ color: '#f1f5f9' }}>{forgotEmail}</strong>.
              </p>

              {devOtp && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '11px', fontWeight: '700', color: '#fbbf24', margin: '0 0 4px' }}>Dev mode — OTP:</p>
                  <p style={{ fontSize: '28px', fontFamily: 'monospace', fontWeight: '700', color: '#fbbf24', margin: 0, letterSpacing: '8px' }}>{devOtp}</p>
                </div>
              )}

              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 6-Digit OTP */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.04em', textAlign: 'center' }}>
                    ENTER VERIFICATION CODE
                  </label>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '6px' }}>
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
                          width: '46px', height: '52px', textAlign: 'center', fontSize: '20px', fontWeight: '700',
                          fontFamily: 'monospace', background: d ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `2px solid ${d ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '10px', color: '#f1f5f9', outline: 'none', transition: 'all 0.15s',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>NEW PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 40px 10px 14px', borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)',
                        color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '14px', display: 'flex', alignItems: 'center' }}
                    >
                      {showNewPass ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '5px', letterSpacing: '0.04em' }}>CONFIRM NEW PASSWORD</label>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: `1px solid ${confirmPassword && newPassword !== confirmPassword ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
                      background: 'rgba(255,255,255,0.05)', color: '#f1f5f9', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>Passwords do not match</p>
                  )}
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
                    width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
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
                      Updating password…
                    </>
                  ) : 'Update password →'}
                </button>

                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  {resendTimer > 0 ? (
                    <p style={{ fontSize: '12px', color: '#64748b' }}>Resend code in {resendTimer}s</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestReset}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', fontSize: '12px', fontWeight: '500' }}
                    >
                      Resend verification code
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {/* ── MODE 4: SUCCESS ─────────────────────────────────────── */}
          {mode === 'reset-success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981', marginBottom: '20px' }}>
                <span style={{ fontSize: '32px', color: '#10b981' }}>✓</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>Password updated!</h2>
              <p style={{ fontSize: '14px', color: '#64748b' }}>{successMsg || 'Your password has been changed.'}</p>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '12px' }}>Redirecting to sign in…</p>
            </div>
          )}

        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#475569', marginTop: '20px' }}>Kwudle · Secured with bcrypt · 30-day sessions</p>
      </div>
    </div>
  )
}
