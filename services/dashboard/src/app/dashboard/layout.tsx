import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken, getUser } from '@/lib/auth'
import { Navbar } from '@/components/layout/Navbar'
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <Navbar user={{ email: payload.email, name: user?.name || payload.email.split('@')[0], businessType: user?.businessType || 'startup' }} />
      <main style={{ flex: 1, overflowY: 'auto', padding: isOnboarding ? '0' : '28px 32px' }}>
        {children}
      </main>
      {!isOnboarding && <FloatingAssistant />}
    </div>
  )
}
