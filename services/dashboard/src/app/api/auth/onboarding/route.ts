import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, updateBusinessSetup } from '@/lib/auth'

/**
 * PATCH /api/auth/onboarding
 * Called by the onboarding wizard on completion to persist
 * businessType and mark businessSetupComplete = true.
 *
 * Body: { businessType: 'cafe' | 'restaurant' | 'retail' | 'startup' }
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = cookies().get('kwudle_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = verifyToken(token)
    if (!payload) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })

    const { businessType } = await req.json()
    const validTypes = ['cafe', 'restaurant', 'retail', 'startup']
    if (!validTypes.includes(businessType)) {
      return NextResponse.json(
        { error: `businessType must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    await updateBusinessSetup(payload.email, businessType)
    return NextResponse.json({ success: true, businessType })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
