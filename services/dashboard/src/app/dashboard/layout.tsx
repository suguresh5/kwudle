import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, getUser } from '@/lib/auth'
import { Navbar } from '@/components/layout/Navbar'
import { DashboardBackground } from '@/components/layout/DashboardBackground'
import { FloatingAssistant } from '@/components/ai/FloatingAssistant'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = cookies().get('kwudle_token')?.value
  const payload = token ? verifyToken(token) : null
  if (!payload) redirect('/login')

  // ── Business-setup guard ────────────────────────────────────────────────────
  const pathname = headers().get('x-pathname') || ''
  const isOnboarding = pathname === '/dashboard/onboarding'

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
    <div className="app-canvas" style={{ position: 'relative', minHeight: '100vh' }}>
      <DashboardBackground />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
        <Navbar user={{ email: payload.email, name: user?.name || payload.email.split('@')[0], businessType: user?.businessType || 'startup' }} />
        <main className={isOnboarding ? 'app-main app-main-flush' : 'app-main'}>
          {children}
        </main>
        {!isOnboarding && <FloatingAssistant />}
      </div>
    </div>
  )
}
