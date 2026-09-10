import { NextRequest, NextResponse } from 'next/server'
import { getUser, comparePassword, signToken, signRefreshToken, createUser, hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const user = await getUser(email)
    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Please create an account first.' },
        { status: 401 }
      )
    }

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })

    const token = signToken(email)
    const refreshToken = signRefreshToken(email)

    // Tell the client where to redirect based on onboarding status
    const redirectTo = user.businessSetupComplete ? '/dashboard' : '/dashboard/onboarding'

    const res = NextResponse.json({
      success: true,
      email: user.email,
      name: user.name,
      redirect: redirectTo,
    })
    res.cookies.set('kwudle_token', token, {
      httpOnly: true, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    res.cookies.set('kwudle_refresh', refreshToken, {
      httpOnly: true, sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 24, // 24 days
      path: '/',
    })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
