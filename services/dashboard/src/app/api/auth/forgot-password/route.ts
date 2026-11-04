import { NextRequest, NextResponse } from 'next/server'
import { generateOTP, storeOTP, getUser, sendPasswordResetEmail } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail } = await req.json()
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const user = await getUser(email)
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email address' }, { status: 404 })
    }

    const otp = generateOTP()
    storeOTP(email, otp)
    const sent = await sendPasswordResetEmail(email, user.name, otp)
    if (!sent && (process.env.GMAIL_USER || process.env.RESEND_API_KEY)) {
      return NextResponse.json({ error: 'Unable to send reset email' }, { status: 502 })
    }
    return NextResponse.json({
      success: true,
      emailSent: sent,
      dev: !sent,
      ...(sent ? {} : { otp }),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to send reset code' }, { status: 500 })
  }
}
