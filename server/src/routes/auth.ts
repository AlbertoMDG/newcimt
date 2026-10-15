import { Router } from 'express'
import { z } from 'zod'
import { getPool, sql } from '../db.ts'
import { badRequest, unauthorized } from '../errors.ts'
import {
  SESSION_COOKIE, createSession, destroySession, requireAuth,
  sessionCookieOptions, verifyPassword,
} from '../auth.ts'
import { completeSsoLogin, ssoEnabled, startSsoLogin, upsertSsoUser } from '../sso.ts'

const auth = Router()

// Password sign-in stays available unless explicitly turned off (break-glass in dev)
const localEnabled = () => process.env.AUTH_LOCAL_ENABLED !== 'false'

// The login page asks which sign-in methods to render
auth.get('/providers', (_req, res) => {
  res.json({ local: localEnabled(), sso: ssoEnabled() })
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(256),
  password: z.string().min(1).max(200),
})

// In-memory rate limit: 5 attempts/minute per IP. Single-process app; good enough.
const attempts = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > MAX_ATTEMPTS
}

auth.post('/login', async (req, res, next) => {
  try {
    if (!localEnabled()) throw badRequest('Password sign-in is disabled — use your Microsoft account')
    if (rateLimited(req.ip ?? 'unknown')) {
      throw badRequest('Too many attempts — wait a minute and try again')
    }
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Email and password are required')
    const { email, password } = parsed.data

    const pool = await getPool()
    const r = await pool.request()
      .input('email', sql.NVarChar(256), email)
      .query(`SELECT user_id, email, display_name, password_hash, is_admin
              FROM dbo.users WHERE email = @email AND is_active = 1`)
    const user = r.recordset[0]
    // Same error for unknown user and wrong password — no account enumeration
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw unauthorized('Invalid email or password')
    }

    const token = await createSession(user.user_id, req)
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions())
    res.json({
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      is_admin: Boolean(user.is_admin),
    })
  } catch (e) { next(e) }
})

auth.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE]
    if (typeof token === 'string' && token) await destroySession(token)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  } catch (e) { next(e) }
})

auth.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

// ---------- Azure Entra ID SSO ----------

const SSO_COOKIE = 'cimt_sso'

auth.get('/sso/login', async (_req, res, next) => {
  try {
    if (!ssoEnabled()) throw badRequest('SSO is not configured')
    const { url, state, verifier } = await startSsoLogin()
    // PKCE verifier + state ride in a short-lived HttpOnly cookie (standard practice)
    res.cookie(SSO_COOKIE, JSON.stringify({ s: state, v: verifier }), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 10 * 60_000,
      path: '/api/auth',
    })
    res.redirect(url)
  } catch (e) { next(e) }
})

auth.get('/sso/callback', async (req, res) => {
  const fail = (msg: string) => res.redirect(`/login?error=${encodeURIComponent(msg)}`)
  try {
    const raw = req.cookies?.[SSO_COOKIE]
    res.clearCookie(SSO_COOKIE, { path: '/api/auth' })
    if (typeof raw !== 'string' || !raw) return fail('Sign-in expired — try again')
    const { s: state, v: verifier } = JSON.parse(raw) as { s: string; v: string }

    // Reconstruct the exact callback URL Entra redirected to (query included)
    const redirectUri = new URL(process.env.ENTRA_REDIRECT_URI!)
    const callbackUrl = new URL(redirectUri.pathname + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''), redirectUri.origin)

    const claims = await completeSsoLogin(callbackUrl, state, verifier)
    const profile = await upsertSsoUser(claims)
    if (profile === 'unknown') return fail('Your account is not registered in CIMT — ask an administrator')
    if (!profile.is_active) return fail('Your CIMT account is deactivated — ask an administrator')

    const token = await createSession(profile.user_id, req)
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions())
    res.redirect('/')
  } catch (err) {
    console.error('SSO callback failed:', err)
    fail('Microsoft sign-in failed — try again or contact an administrator')
  }
})

export default auth
