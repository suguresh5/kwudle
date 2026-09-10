import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, createUser, signToken, signRefreshToken, getUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json()
    const result = verifyOTP(email, otp)
    if (!result.valid) return NextResponse.json({ error: result.reason }, { status: 401 })

    const { name, passwordHash } = result.data
    // createUser is idempotent via ReplacingMergeTree — safe to call even if user exists
    await createUser(email, name, passwordHash)

    const user = await getUser(email)
    const redirectTo = user?.businessSetupComplete ? '/dashboard' : '/dashboard/onboarding'

    const token = signToken(email)
    const refreshToken = signRefreshToken(email)

    const res = NextResponse.json({
      success: true,
      email,
      name,
      redirect: redirectTo,
    })
    res.cookies.set('kwudle_token', token, {
      httpOnly: true, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    res.cookies.set('kwudle_refresh', refreshToken, {
      httpOnly: true, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 24,
      path: '/',
    })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
