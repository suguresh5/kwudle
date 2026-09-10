import { NextRequest, NextResponse } from 'next/server'
import { verifyOTP, hashPassword, updatePassword, getUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword } = await req.json()
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const verification = verifyOTP(email, otp)
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason || 'Invalid or expired code' }, { status: 400 })
    }

    const user = await getUser(email)
    if (!user) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 })
    }

    const newHash = await hashPassword(newPassword)
    await updatePassword(email, newHash)

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reset password' }, { status: 500 })
  }
}
