import { NextRequest, NextResponse } from 'next/server'

// ── Demo mode: bypass auth entirely ──────────────────────────────────────────
const DEMO_MODE = true

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow Next.js internals and API routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // In demo mode: auto-redirect root to dashboard, skip all auth
  if (DEMO_MODE) {
    if (pathname === '/' || pathname === '/login' || pathname === '/signup') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pathname', pathname)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const token = req.cookies.get('kwudle_token')?.value

  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) {
    const response = NextResponse.next()
    response.cookies.delete('kwudle_token')
    response.cookies.delete('kwudle_refresh')
    return response
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-pathname', pathname)
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
