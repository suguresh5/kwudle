import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, getUser } from '@/lib/auth'
import { Navbar } from '@/components/layout/Navbar'
import { FloatingAssistant } from '@/components/ai/FloatingAssistant'

// ── Demo mode: skip all auth checks ──────────────────────────────────────────
const DEMO_MODE = true
const DEMO_USER = { email: 'demo@kwudle.dev', name: 'Demo User', businessType: 'restaurant', businessSetupComplete: true }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = headers().get('x-pathname') || ''
  const isOnboarding = pathname === '/dashboard/onboarding'

  // ── Demo mode: use hardcoded user, skip token & DB ───────────────────────────
  if (DEMO_MODE) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
        <Navbar user={{ email: DEMO_USER.email, name: DEMO_USER.name, businessType: DEMO_USER.businessType }} />
        <main style={{ flex: 1, overflowY: 'auto', padding: isOnboarding ? '0' : '28px 32px' }}>
          {children}
        </main>
        {!isOnboarding && <FloatingAssistant />}
      </div>
    )
  }

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = cookies().get('kwudle_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) redirect('/login')

  // ── Business-setup guard ────────────────────────────────────────────────────
  let user = null
  try {
    user = await getUser(payload.email)
  } catch (e) {
    console.error('[DashboardLayout] getUser error:', e)
  }

  if (user && !user.businessSetupComplete && !isOnboarding) {
    redirect('/dashboard/onboarding')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <Navbar user={{ email: payload.email, name: user?.name || payload.email.split('@')[0], businessType: user?.businessType || 'startup' }} />
      <main style={{ flex: 1, overflowY: 'auto', padding: isOnboarding ? '0' : '28px 32px' }}>
        {children}
      </main>
      {!isOnboarding && <FloatingAssistant />}
    </div>
  )
}
