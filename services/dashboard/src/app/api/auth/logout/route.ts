import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logged out successfully' })

  // Expire auth cookies immediately across all paths
  res.cookies.set('kwudle_token', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })

  res.cookies.set('kwudle_refresh', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  })

  return res
}
