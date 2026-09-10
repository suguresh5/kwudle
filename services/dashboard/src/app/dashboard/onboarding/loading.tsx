'use client'

export default function OnboardingLoading() {
  return (
    <div style={{ minHeight: 'calc(100vh - 112px)', padding: '40px 24px', display: 'flex', justifyContent: 'center', background: 'radial-gradient(circle at 50% 0%, var(--brand-light), transparent 42%)' }}>
      <div style={{ width: '100%', maxWidth: '760px' }}>
        <div style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '16px', background: 'var(--bg-2)' }} />
        <div style={{ width: '260px', height: '28px', margin: '0 auto 10px', borderRadius: '8px', background: 'var(--bg-2)' }} />
        <div style={{ width: '360px', maxWidth: '90%', height: '16px', margin: '0 auto 32px', borderRadius: '6px', background: 'var(--bg-2)' }} />
        <div style={{ height: '360px', borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--glass-bg)' }} />
      </div>
    </div>
  )
}
