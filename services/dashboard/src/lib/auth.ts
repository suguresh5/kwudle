import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import nodemailer from 'nodemailer'

const JWT_SECRET = process.env.JWT_SECRET || 'kwudle-secret-2024-change-in-prod'
const OTP_EXPIRY = 10 * 60 * 1000

// OTP store stays in-memory — OTPs are short-lived and don't need durability
const otpStore = new Map<string, { otp: string; expires: number; data?: any }>()

// ─── ClickHouse HTTP helpers ──────────────────────────────────────────────────

const CH_HOST = process.env.CLICKHOUSE_HOST || (process.env.NODE_ENV === 'production' ? 'clickhouse-01' : 'localhost')
const CH_PORT = process.env.CLICKHOUSE_PORT || '8123'
const CH_USER = process.env.CLICKHOUSE_USER || 'sentinel_user'
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || 'Sentinel123'

function chBasicAuth() {
  return 'Basic ' + Buffer.from(`${CH_USER}:${CH_PASS}`).toString('base64')
}

async function chQuery<T = any>(sql: string): Promise<T[]> {
  const res = await fetch(
    `http://${CH_HOST}:${CH_PORT}/?query=${encodeURIComponent(sql + ' FORMAT JSONEachRow')}`,
    { headers: { Authorization: chBasicAuth() }, cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`ClickHouse query error ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text.trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) as T[]
}

async function chInsert(sql: string): Promise<void> {
  const res = await fetch(`http://${CH_HOST}:${CH_PORT}/`, {
    method: 'POST',
    body: sql,
    headers: { Authorization: chBasicAuth() },
  })
  if (!res.ok) throw new Error(`ClickHouse insert error ${res.status}: ${await res.text()}`)
}

// ─── User shape ───────────────────────────────────────────────────────────────

export interface DashboardUser {
  email: string
  name: string
  passwordHash: string
  businessSetupComplete: boolean
  businessType: string
  createdAt: string
}

// ─── Persistent user operations ───────────────────────────────────────────────

export async function getUser(email: string): Promise<DashboardUser | null> {
  try {
    const rows = await chQuery<{
      email: string
      name: string
      password_hash: string
      business_setup_complete: number
      business_type: string
      created_at: string
    }>(
      `SELECT email, name, password_hash, business_setup_complete, business_type, created_at
       FROM sentinel.dashboard_users FINAL
       WHERE email = '${email.toLowerCase().replace(/'/g, "''")}'
       LIMIT 1`
    )
    if (!rows.length) return null
    const r = rows[0]
    return {
      email: r.email,
      name: r.name,
      passwordHash: r.password_hash,
      businessSetupComplete: Boolean(r.business_setup_complete),
      businessType: r.business_type,
      createdAt: r.created_at,
    }
  } catch (err) {
    console.error('[auth] getUser error:', err)
    return null
  }
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<void> {
  const esc = (s: string) => s.replace(/'/g, "''")
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  await chInsert(
    `INSERT INTO sentinel.dashboard_users
     (email, name, password_hash, business_setup_complete, business_type, created_at, updated_at)
     VALUES ('${esc(email.toLowerCase())}','${esc(name)}','${esc(passwordHash)}',0,'','${now}','${now}')`
  )
}

export async function updateBusinessSetup(email: string, businessType: string): Promise<void> {
  const esc = (s: string) => s.replace(/'/g, "''")
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  // ReplacingMergeTree picks latest updated_at — insert a new version row
  const user = await getUser(email)
  if (!user) throw new Error('User not found')
  await chInsert(
    `INSERT INTO sentinel.dashboard_users
     (email, name, password_hash, business_setup_complete, business_type, created_at, updated_at)
     VALUES ('${esc(email.toLowerCase())}','${esc(user.name)}','${esc(user.passwordHash)}',1,'${esc(businessType)}','${user.createdAt.replace('T',' ').replace('Z','')}','${now}')`
  )
}

export async function updatePassword(email: string, newPasswordHash: string): Promise<void> {
  const esc = (s: string) => s.replace(/'/g, "''")
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  const user = await getUser(email)
  if (!user) throw new Error('User not found')
  await chInsert(
    `INSERT INTO sentinel.dashboard_users
     (email, name, password_hash, business_setup_complete, business_type, created_at, updated_at)
     VALUES ('${esc(email.toLowerCase())}','${esc(user.name)}','${esc(newPasswordHash)}',${user.businessSetupComplete ? 1 : 0},'${esc(user.businessType)}','${user.createdAt.replace('T',' ').replace('Z','')}','${now}')`
  )
}


// ─── OTP ─────────────────────────────────────────────────────────────────────

export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString()
}

export function storeOTP(email: string, otp: string, data?: any) {
  otpStore.set(email.toLowerCase(), { otp, expires: Date.now() + OTP_EXPIRY, data })
}

export function verifyOTP(email: string, otp: string) {
  const rec = otpStore.get(email.toLowerCase())
  if (!rec) return { valid: false, reason: 'No OTP found. Request a new one.' }
  if (Date.now() > rec.expires) {
    otpStore.delete(email.toLowerCase())
    return { valid: false, reason: 'OTP expired.' }
  }
  if (rec.otp !== otp) return { valid: false, reason: 'Invalid OTP.' }
  const data = rec.data
  otpStore.delete(email.toLowerCase())
  return { valid: true, data }
}

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

// ─── JWT (access: 7d, refresh: 24d) ──────────────────────────────────────────

export function signToken(email: string) {
  return jwt.sign({ email, type: 'access' }, JWT_SECRET, { expiresIn: '7d' })
}

export function signRefreshToken(email: string) {
  return jwt.sign({ email, type: 'refresh' }, JWT_SECRET, { expiresIn: '24d' })
}

export function verifyToken(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email: string; type?: string }
    if (payload.type && payload.type !== 'access') return null
    return { email: payload.email }
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email: string; type?: string }
    if (payload.type !== 'refresh') return null
    return { email: payload.email }
  } catch {
    return null
  }
}

// ─── OTP email ───────────────────────────────────────────────────────────────

export async function sendOTPEmail(email: string, name: string, otp: string) {
  const gmailUser = process.env.GMAIL_USER
  const rawPass = process.env.GMAIL_APP_PASSWORD || ''
  const gmailPass = rawPass.replace(/\s+/g, '')

  if (!gmailUser || !gmailPass) {
    console.log(`\n🔐 OTP for ${email}: ${otp}\n`)
    return false
  }
  try {
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })
    await t.sendMail({
      from: `"Kwudle Security" <${gmailUser}>`,
      to: email,
      subject: `${otp} is your Kwudle verification code`,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #0f172a; color: #f1f5f9; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #f1f5f9; margin-top: 12px; font-size: 22px; font-weight: 700;">Welcome to Kwudle${name ? ', ' + name : ''}!</h2>
          <p style="color: #94a3b8; font-size: 14px;">Use the code below to complete your verification:</p>
        </div>
        <div style="background: rgba(59, 130, 246, 0.1); border: 2px dashed rgba(99, 102, 241, 0.5); border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #60a5fa;">${otp}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 8px;">Valid for 10 minutes</div>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;">
          🔒 Never share this code with anyone. If you did not request this code, you can safely ignore this email.
        </p>
      </div>`,
    })
    console.log(`[auth] ✅ OTP successfully sent via Gmail to ${email}`)
    return true
  } catch (mailErr: any) {
    console.error('[auth] ❌ Failed to send email via Gmail SMTP:', mailErr.message)
    return false
  }
}

export async function sendPasswordResetEmail(email: string, name: string, otp: string) {
  const gmailUser = process.env.GMAIL_USER
  const rawPass = process.env.GMAIL_APP_PASSWORD || ''
  const gmailPass = rawPass.replace(/\s+/g, '')

  if (!gmailUser || !gmailPass) {
    console.log(`\n🔐 Password Reset OTP for ${email}: ${otp}\n`)
    return false
  }
  try {
    const t = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    })
    await t.sendMail({
      from: `"Kwudle Security" <${gmailUser}>`,
      to: email,
      subject: `${otp} — Reset your Kwudle password`,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #0f172a; color: #f1f5f9; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #f1f5f9; margin-top: 12px; font-size: 22px; font-weight: 700;">Password Reset Request</h2>
          <p style="color: #94a3b8; font-size: 14px;">Hello${name ? ' ' + name : ''}, we received a request to reset your password. Use the verification code below:</p>
        </div>
        <div style="background: rgba(239, 68, 68, 0.1); border: 2px dashed rgba(239, 68, 68, 0.5); border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #f87171;">${otp}</div>
          <div style="color: #64748b; font-size: 12px; margin-top: 8px;">Valid for 10 minutes</div>
        </div>
        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.5;">
          🔒 Never share this code with anyone. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>`,
    })
    console.log(`[auth] ✅ Password reset OTP sent via Gmail to ${email}`)
    return true
  } catch (mailErr: any) {
    console.error('[auth] ❌ Failed to send password reset email via Gmail SMTP:', mailErr.message)
    return false
  }
}
