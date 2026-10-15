// Identity layer: password hashing, sessions, and auth middlewares.
// Provider-agnostic by design — local login today, Entra ID SSO later only
// changes how a session gets created, never how it is checked.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { NextFunction, Request, Response } from 'express'
import { getPool, sql } from './db.ts'
import { forbidden, unauthorized } from './errors.ts'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export interface SessionUser {
  user_id: number
  email: string
  display_name: string
  is_admin: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

// ---------- passwords (scrypt, node:crypto only) ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `s1$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false
  const [ver, saltB64, hashB64] = stored.split('$')
  if (ver !== 's1' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}

// ---------- sessions ----------

export const SESSION_COOKIE = 'cimt_session'
const SESSION_HOURS = 12
// Sliding window: extend when less than this many hours remain
const SLIDE_THRESHOLD_HOURS = 6

const sha256 = (token: string) => createHash('sha256').update(token).digest()

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: SESSION_HOURS * 60 * 60_000,
    path: '/',
  }
}

export async function createSession(userId: number, req: Request): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const pool = await getPool()
  await pool.request()
    .input('token_hash', sql.Binary, sha256(token))
    .input('user_id', sql.Int, userId)
    .input('ip', sql.NVarChar(45), req.ip ?? null)
    .input('user_agent', sql.NVarChar(300), (req.headers['user-agent'] ?? '').slice(0, 300) || null)
    .query(`INSERT INTO dbo.sessions (token_hash, user_id, expires_at, ip, user_agent)
            VALUES (@token_hash, @user_id, DATEADD(HOUR, ${SESSION_HOURS}, SYSUTCDATETIME()), @ip, @user_agent);
            UPDATE dbo.users SET last_login_at = SYSUTCDATETIME() WHERE user_id = @user_id`)
  return token
}

export async function destroySession(token: string): Promise<void> {
  const pool = await getPool()
  await pool.request()
    .input('token_hash', sql.Binary, sha256(token))
    .query('UPDATE dbo.sessions SET revoked_at = SYSUTCDATETIME() WHERE token_hash = @token_hash')
}

/** Resolve the session cookie to a user; null if missing/expired/revoked/inactive. */
async function resolveSession(req: Request): Promise<SessionUser | null> {
  const token = req.cookies?.[SESSION_COOKIE]
  if (typeof token !== 'string' || !token) return null
  const pool = await getPool()
  const r = await pool.request()
    .input('token_hash', sql.Binary, sha256(token))
    .query(`SELECT s.session_id, s.expires_at, u.user_id, u.email, u.display_name, u.is_admin
            FROM dbo.sessions s
            JOIN dbo.users u ON u.user_id = s.user_id
            WHERE s.token_hash = @token_hash
              AND s.revoked_at IS NULL
              AND s.expires_at > SYSUTCDATETIME()
              AND u.is_active = 1`)
  const row = r.recordset[0]
  if (!row) return null
  const remainingMs = new Date(row.expires_at).getTime() - Date.now()
  if (remainingMs < SLIDE_THRESHOLD_HOURS * 60 * 60_000) {
    await pool.request()
      .input('id', sql.Int, row.session_id)
      .query(`UPDATE dbo.sessions SET expires_at = DATEADD(HOUR, ${SESSION_HOURS}, SYSUTCDATETIME())
              WHERE session_id = @id`)
  }
  return {
    user_id: row.user_id,
    email: row.email,
    display_name: row.display_name,
    is_admin: Boolean(row.is_admin),
  }
}

// ---------- middlewares ----------

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      const user = await resolveSession(req)
      if (!user) throw unauthorized()
      req.user = user
    }
    next()
  } catch (e) {
    next(e)
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err)
    if (!req.user?.is_admin) return next(forbidden('Admin access required'))
    next()
  })
}

/** Reads require a session; writes additionally require admin. For admin-managed CRUD. */
export function adminWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET') return next()
  requireAdmin(req, res, next)
}
