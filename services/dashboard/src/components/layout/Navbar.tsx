'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { KwudleLogo } from '@/components/ui/KwudleLogo'
import { GooeyNav } from '@/components/ui/GooeyNav'
import { useEffect, useState, useRef, useMemo } from 'react'

// ─── SVG Icon helpers (inline to avoid icon-library deps) ─────────────────────

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconCommand() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
function IconRocket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  )
}
function IconCoffee() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/>
      <line x1="10" y1="2" x2="10" y2="4"/>
      <line x1="14" y1="2" x2="14" y2="4"/>
    </svg>
  )
}
function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconFilter() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}
function IconServer() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  )
}
function IconFile() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}
function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
function IconMoon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}


// ─── Navigation config with SVG icons ─────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',             label: 'Command Center', IconComp: IconCommand,  color: '#60a5fa' },
  { href: '/dashboard/funnel',      label: 'Funnel',         IconComp: IconFilter,   color: '#f59e0b' },
  { href: '/dashboard/heatmap',     label: 'Heatmap',        IconComp: IconActivity, color: '#ef4444' },
  { href: '/dashboard/suggestions', label: 'Suggestions',    IconComp: IconCoffee,   color: '#10b981' },
  { href: '/dashboard/sessions',    label: 'Sessions',       IconComp: IconUsers,    color: '#8b5cf6' },
  { href: '/dashboard/deployments', label: 'Deployments',    IconComp: IconRocket,   color: '#3b82f6' },
  { href: '/dashboard/logs',        label: 'Logs',           IconComp: IconFile,     color: '#64748b' },
  { href: '/dashboard/alerts',      label: 'Alerts',         IconComp: IconBell,     color: '#f87171' },
]


// ─── Pill tab helper ──────────────────────────────────────────────────────────
function NavPill({ href, label, IconComp, color, isActive }: {
  href: string; label: string; IconComp: React.FC; color: string; isActive: boolean
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '6px 11px',
        borderRadius: '999px',
        fontSize: '12.5px',
        fontWeight: isActive ? 600 : 500,
        textDecoration: 'none',
        color: isActive ? 'var(--text)' : 'var(--text-2)',
        background: isActive ? 'var(--bg-1)' : 'transparent',
        border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
        boxShadow: isActive ? 'var(--shadow)' : 'none',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--bg-2)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-2)'
        }
      }}
    >
      <span style={{ color: isActive ? color : 'var(--text-3)', display: 'flex' }}><IconComp /></span>
      <span>{label}</span>
    </Link>
  )
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export function Navbar({ user }: { user?: { email: string; name?: string; businessType?: string } }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    // Clean storage and perform full window redirect to flush cookies
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {}
    window.location.href = '/login'
  }

  const displayName = user?.name || user?.email?.split('@')[0] || 'User'
  const displayEmail = user?.email || 'admin@kwudle.io'
  const initial = displayName.charAt(0).toUpperCase()

  // Show back arrow if on a sub-page
  const isSubPage = pathname !== '/dashboard' && pathname.startsWith('/dashboard/')
  // Determine business-specific icon for the brand
  const bizIcon = user?.businessType === 'cafe' || user?.businessType === 'restaurant'
    ? <IconCoffee />
    : <IconRocket />

  const activeNavIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex(item => {
      if (item.href === '/dashboard') {
        return pathname === '/dashboard'
      }
      return pathname === item.href || pathname.startsWith(item.href + '/')
    })
    return idx >= 0 ? idx : 0
  }, [pathname])

  const gooeyItems = useMemo(() => {
    return NAV_ITEMS.map(item => {
      const Icon = item.IconComp
      return {
        label: item.label,
        href: item.href,
        icon: (
          <span style={{ color: item.color, display: 'flex', alignItems: 'center' }}>
            <Icon />
          </span>
        )
      }
    })
  }, [])

  if (pathname === '/dashboard/onboarding') return null

  return (
    <>
      <header id="kwudle-navbar" style={{
        position: 'sticky', top: '16px', zIndex: 50,
        display: 'flex', justifyContent: 'center', width: '100%',
        margin: '16px 0 8px 0',
        padding: '0 24px',
        background: 'transparent',
        border: 'none',
        borderBottom: 'none',
        boxShadow: 'none',
        backdropFilter: 'none', WebkitBackdropFilter: 'none',
        pointerEvents: 'none',
        flexShrink: 0,
      }}>
        {/* ── Floating Main Nav Bar: Brand (Left) + Centered Gooey Nav + User / Controls (Right) ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', maxWidth: '1440px', position: 'relative', gap: '16px',
          pointerEvents: 'auto',
        }}>
          {/* Left: Brand (no background capsule) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '11px', flexShrink: 0, zIndex: 2,
          }}>
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '11px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
                flexShrink: 0, color: 'white',
              }}>
                <KwudleLogo size={24} />
              </div>
              <span style={{ fontSize: '19px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px' }}>
                Kwudle
              </span>
            </Link>


            {/* System status beacon */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '99px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#10b981', letterSpacing: '0.04em' }}>
                Live
              </span>
            </div>

            {user?.businessType && (
              <span style={{
                fontSize: '11.5px', fontWeight: '600', color: 'var(--text-3)',
                background: 'var(--bg-2)', padding: '4px 9px', borderRadius: '7px',
                border: '1px solid var(--border)',
                textTransform: 'capitalize',
              }}>
                {user.businessType}
              </span>
            )}

          </div>

          {/* Center: In-Between GooeyNav Bar */}
          <div
            className="kwudle-desktop-nav"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              minWidth: 0,
              padding: '0 4px',
            }}
          >
            <GooeyNav
              items={gooeyItems}
              activeIndex={activeNavIndex}
              theme={resolvedTheme === 'light' ? 'light' : 'dark'}
              size="md"
              frame={true}
              color="#2563eb"
              activeTextColor="#ffffff"
              colors={['#3b82f6', '#60a5fa', '#6366f1', '#8b5cf6']}
              particleCount={14}
              spread={46}
              animationTime={480}
              timeVariance={180}
              gooeyness={0.5}
              wobble={0.4}
              hoverEffect={true}
            />
          </div>

          {/* Right: Theme + User (no background capsule) */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, zIndex: 2,
          }}>
            {mounted && (
              <button
                id="kwudle-theme-toggle"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  width: '38px', height: '38px', borderRadius: '11px',
                  border: 'none',
                  background: 'transparent', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-2)', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--text)'
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-2)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {resolvedTheme === 'dark' ? <IconMoon /> : <IconSun />}
              </button>
            )}

            {/* User profile dropdown */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                id="kwudle-user-trigger"
                onClick={() => setUserDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px',
                  padding: '4px 8px 4px 4px', borderRadius: '12px',
                  border: 'none',
                  background: userDropdownOpen ? 'var(--bg-hover)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => { if (!userDropdownOpen) e.currentTarget.style.background = 'transparent' }}
                aria-haspopup="true"
                aria-expanded={userDropdownOpen}
              >
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: '700', fontSize: '14px',
                }}>
                  {initial}
                </div>
                <span style={{
                  fontSize: '14.5px', fontWeight: '700', color: 'var(--text)',
                  maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
              </button>

              {/* Profile Popover */}
              {userDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: '240px', background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  borderRadius: '16px', padding: '12px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.35)', zIndex: 100,
                  animation: 'fadeUp 0.15s ease both',
                }}>
                  {/* User info */}
                  <div style={{ padding: '6px 8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text)' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayEmail}
                    </div>
                    <div style={{
                      marginTop: '8px', display: 'inline-block',
                      padding: '2px 8px', borderRadius: '4px',
                      background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                      fontSize: '10.5px', fontWeight: '600',
                    }}>
                      Enterprise Workspace
                    </div>
                  </div>

                  {/* Sign Out */}
                  <div style={{ paddingTop: '6px' }}>
                    <button
                      id="kwudle-logout-btn"
                      onClick={handleLogout}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 10px', borderRadius: '8px', border: 'none',
                        background: 'transparent', color: '#f87171',
                        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              id="kwudle-hamburger"
              onClick={() => setMobileOpen(o => !o)}
              className="kwudle-hamburger-btn"
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                cursor: 'pointer', padding: '6px 9px', color: 'var(--text-2)', fontSize: '16px',
              }}
              aria-label="Open navigation"
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', top: '90px', left: 0, right: 0, zIndex: 49,
          background: 'var(--glass-bg)', borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          padding: '16px 20px 24px',
          animation: 'fadeUp 0.2s ease both',
        }}
          className="kwudle-mobile-drawer"
        >
          <div className="section-label" style={{ marginBottom: '8px' }}>Navigation</div>
          {NAV_ITEMS.map(({ href, label, IconComp, color }) => (
            <Link key={href} href={href}
              onClick={() => setMobileOpen(false)}
              className={`nav-item${pathname === href ? ' active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}
            >
              <span style={{ color }}><IconComp /></span>
              {label}
            </Link>
          ))}
        </div>
      )}

      {/* ── Responsive styles ──────────────────────────────────────────────────── */}
      <style>{`
        .kwudle-hamburger-btn { display: none !important; }
        .kwudle-mobile-drawer { display: none !important; }
        .kwudle-desktop-nav::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .kwudle-desktop-nav { display: none !important; }
          .kwudle-hamburger-btn { display: flex !important; }
          .kwudle-mobile-drawer { display: block !important; }
        }
      `}
      </style>
    </>
  )
}
