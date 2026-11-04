import { NextRequest, NextResponse } from 'next/server'
import { generateOTP, storeOTP, hashPassword, getUser, sendOTPEmail } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail, name, password } = await req.json()
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    if (!email || !name || !password) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    const existing = await getUser(email)
    if (existing) return NextResponse.json({ error: 'Account already exists. Please log in.' }, { status: 409 })
    const passwordHash = await hashPassword(password)
    const otp = generateOTP()
    storeOTP(email, otp, { email, name, passwordHash })
    const sent = await sendOTPEmail(email, name, otp)
    if (!sent && (process.env.GMAIL_USER || process.env.RESEND_API_KEY)) {
      return NextResponse.json({ error: 'Unable to send verification email' }, { status: 502 })
    }
    return NextResponse.json({ success: true, emailSent: sent, dev: !sent, ...(sent ? {} : { otp }) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
