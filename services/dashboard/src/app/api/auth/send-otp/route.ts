import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, storeOTP, sendOTPEmail } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email: rawEmail } = await req.json();
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const otp = generateOTP();
    storeOTP(email, otp);

    const sent = await sendOTPEmail(email, '', otp);
    if (!sent && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unable to send verification email' }, { status: 502 });
    }
    return NextResponse.json({ success: true, dev: !sent, ...(sent ? {} : { otp }) });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
  }
}
