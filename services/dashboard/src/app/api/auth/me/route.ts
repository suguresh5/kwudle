import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('kwudle_token')?.value
  if (!token) return NextResponse.json({ user: null }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ user: null }, { status: 401 })
  const user = await getUser(payload.email)
  return NextResponse.json({
    user: {
      email: payload.email,
      name: user?.name || payload.email.split('@')[0],
      businessType: user?.businessType || 'startup',
      businessSetupComplete: user?.businessSetupComplete ?? true,
    }
  })
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete('kwudle_token')
  return res
}
