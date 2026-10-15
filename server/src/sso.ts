// Azure Entra ID SSO (OIDC authorization code + PKCE via openid-client v6).
// This module only swaps the identity provider: it resolves an Entra sign-in to
// a row in dbo.users and the rest of the app keeps using the same sessions.
import * as oidc from 'openid-client'
import { getPool, sql } from './db.ts'

export interface SsoProfile {
  user_id: number
  is_active: boolean
}

export function ssoEnabled(): boolean {
  return Boolean(
    process.env.ENTRA_TENANT_ID && process.env.ENTRA_CLIENT_ID &&
    process.env.ENTRA_CLIENT_SECRET && process.env.ENTRA_REDIRECT_URI,
  )
}

let config: oidc.Configuration | null = null

async function getConfig(): Promise<oidc.Configuration> {
  if (config) return config
  // Works for a real tenant AND for a mock OIDC server via ENTRA_ISSUER override
  const issuer = new URL(
    process.env.ENTRA_ISSUER
      ?? `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
  )
  config = await oidc.discovery(
    issuer,
    process.env.ENTRA_CLIENT_ID!,
    process.env.ENTRA_CLIENT_SECRET!,
    undefined,
    // openid-client refuses plain http unless told otherwise — needed only for
    // a local mock OIDC server (docs/sso.md, option B); real Entra is https
    issuer.protocol === 'http:' ? { execute: [oidc.allowInsecureRequests] } : undefined,
  )
  return config
}

export interface SsoStart {
  url: string
  state: string
  verifier: string
}

export async function startSsoLogin(): Promise<SsoStart> {
  const cfg = await getConfig()
  const verifier = oidc.randomPKCECodeVerifier()
  const state = oidc.randomState()
  const url = oidc.buildAuthorizationUrl(cfg, {
    redirect_uri: process.env.ENTRA_REDIRECT_URI!,
    scope: 'openid profile email',
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: 'S256',
    state,
  })
  return { url: url.href, state, verifier }
}

/** Exchange the callback for validated ID-token claims. */
export async function completeSsoLogin(
  callbackUrl: URL,
  state: string,
  verifier: string,
): Promise<oidc.IDToken> {
  const cfg = await getConfig()
  const tokens = await oidc.authorizationCodeGrant(cfg, callbackUrl, {
    expectedState: state,
    pkceCodeVerifier: verifier,
  })
  const claims = tokens.claims()
  if (!claims) throw new Error('No ID token in the SSO response')
  return claims
}

/**
 * Resolve validated claims to a user row: match by entra_oid, then by email
 * (linking pre-SSO accounts), else auto-provision unless disabled.
 */
export async function upsertSsoUser(claims: oidc.IDToken): Promise<SsoProfile | 'unknown'> {
  const oid = typeof claims.oid === 'string' ? claims.oid : claims.sub
  const email = String(claims.email ?? claims.preferred_username ?? '').trim().toLowerCase()
  const name = String(claims.name ?? email.split('@')[0] ?? 'Unknown').slice(0, 200)
  if (!email || !email.includes('@')) throw new Error('The SSO profile has no email claim')

  const pool = await getPool()
  const existing = (await pool.request()
    .input('oid', sql.NVarChar(64), oid)
    .input('email', sql.NVarChar(256), email)
    .query(`SELECT TOP 1 user_id, is_active FROM dbo.users
            WHERE entra_oid = @oid OR (entra_oid IS NULL AND email = @email)
            ORDER BY CASE WHEN entra_oid = @oid THEN 0 ELSE 1 END`)).recordset[0]

  if (existing) {
    await pool.request()
      .input('id', sql.Int, existing.user_id)
      .input('oid', sql.NVarChar(64), oid)
      .input('email', sql.NVarChar(256), email)
      .input('name', sql.NVarChar(200), name)
      .query(`UPDATE dbo.users
              SET entra_oid = @oid, email = @email, display_name = @name,
                  last_login_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME(), updated_by = 'sso'
              WHERE user_id = @id`)
    return { user_id: existing.user_id, is_active: Boolean(existing.is_active) }
  }

  if (process.env.ENTRA_AUTO_PROVISION === 'false') return 'unknown'

  const r = await pool.request()
    .input('oid', sql.NVarChar(64), oid)
    .input('email', sql.NVarChar(256), email)
    .input('name', sql.NVarChar(200), name)
    .query(`INSERT INTO dbo.users (email, display_name, entra_oid, is_admin, is_active, last_login_at, updated_by)
            OUTPUT INSERTED.user_id
            VALUES (@email, @name, @oid, 0, 1, SYSUTCDATETIME(), 'sso')`)
  return { user_id: r.recordset[0].user_id, is_active: true }
}
