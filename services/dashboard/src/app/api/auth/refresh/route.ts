import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyRefreshToken, signToken } from '@/lib/auth'

/**
 * POST /api/auth/refresh
 * Accepts the kwudle_refresh cookie and issues a new 7-day access token.
 */
export async function POST(req: NextRequest) {
  try {
    const refreshToken = cookies().get('kwudle_refresh')?.value
    if (!refreshToken) return NextResponse.json({ error: 'No refresh token' }, { status: 401 })

    const payload = verifyRefreshToken(refreshToken)
    if (!payload) return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 })

    const newToken = signToken(payload.email)
    const res = NextResponse.json({ success: true })
    res.cookies.set('kwudle_token', newToken, {
      httpOnly: true, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
