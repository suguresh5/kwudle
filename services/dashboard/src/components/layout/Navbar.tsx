'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { KwudleLogo } from '@/components/ui/KwudleLogo'
import { useEffect, useState, useRef } from 'react'

// ─── SVG Icon helpers (inline to avoid icon-library deps) ─────────────────────

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconCommand() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
function IconRocket() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  )
}
function IconCoffee() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
function IconActivity() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}
function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}
function IconBell() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconFilter() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
    </svg>
  )
}
function IconZap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}
function IconServer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  )
}
function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '10px',
        fontSize: '12.5px',
        fontWeight: isActive ? '700' : '500',
        textDecoration: 'none',
        color: isActive ? color : 'var(--text-3)',
        background: isActive ? `${color}15` : 'transparent',
        border: isActive ? `1px solid ${color}30` : '1px solid transparent',
        transition: 'all 0.2s ease',
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
          e.currentTarget.style.color = 'var(--text-3)'
        }
      }}
    >
      <IconComp />
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

  if (pathname === '/dashboard/onboarding') return null

  return (
    <>
      <header id="kwudle-navbar" style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 96%, var(--brand) 4%), var(--glass-bg))',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
        flexShrink: 0,
      }}>
        {/* ── Top Bar: Brand + Controls ──────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: '56px', padding: '0 24px',
        }}>
          {/* Left: Back + Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Back button */}
            {isSubPage && (
              <button
                id="kwudle-back-btn"
                onClick={() => window.location.assign('/dashboard')}
                title="Go back"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '32px', height: '32px', borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-2)', color: 'var(--text-2)',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--brand)'
                  e.currentTarget.style.color = 'var(--brand)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-2)'
                }}
              >
                <IconBack />
              </button>
            )}

            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '9px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                flexShrink: 0, color: 'white',
              }}>
                <KwudleLogo size={16} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text)', letterSpacing: '-0.3px' }}>
                Kwudle
              </span>
            </Link>


            {/* System status beacon */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 8px', borderRadius: '99px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block',
              }} />
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#10b981', letterSpacing: '0.04em' }}>
                Live
              </span>
            </div>

            {user?.businessType && (
              <span style={{
                fontSize: '10px', fontWeight: '600', color: 'var(--text-3)',
                background: 'var(--bg-2)', padding: '2px 7px', borderRadius: '5px',
                border: '1px solid var(--border)',
                textTransform: 'capitalize',
              }}>
                {user.businessType}
              </span>
            )}

          </div>

          {/* Right: Theme + User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {mounted && (
              <button
                id="kwudle-theme-toggle"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                style={{
                  width: '34px', height: '34px', borderRadius: '9px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-2)', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-2)', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--brand)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-2)'
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
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '4px 10px 4px 4px', borderRadius: '10px',
                  border: '1px solid var(--border)',
                  background: userDropdownOpen ? 'var(--bg-2)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                onMouseLeave={e => { if (!userDropdownOpen) e.currentTarget.style.background = 'transparent' }}
                aria-haspopup="true"
                aria-expanded={userDropdownOpen}
              >
                <div style={{
                  width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: '700', fontSize: '11px',
                }}>
                  {initial}
                </div>
                <span style={{
                  fontSize: '12.5px', fontWeight: '600', color: 'var(--text)',
                  maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {displayName}
                </span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    color: 'var(--text-3)',
                    transform: userDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
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

        {/* ── Bottom Row: Scrollable Pill Tabs ──────────────────────── */}
        <nav
          className="kwudle-desktop-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 24px 10px',
            borderTop: '1px solid color-mix(in srgb, var(--border) 65%, transparent)',
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {NAV_ITEMS.map(item => (
            <NavPill
              key={item.href}
              href={item.href}
              label={item.label}
              IconComp={item.IconComp}
              color={item.color}
              isActive={
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')
              }
            />
          ))}
        </nav>
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
