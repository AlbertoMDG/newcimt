// Incident-data encryption: AES-256-GCM with one data key per incident, wrapped
// by a master key from the environment. Server-side encryption by design — the
// server can decrypt, so the incident record stays auditable/exportable.
//
// Wrapped data key layout (stored in dbo.incidents.data_key):
//   [version(1)=0x01][iv(12)][auth_tag(16)][encrypted_key(32)]  = 61 bytes
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface EncryptedPayload {
  iv: Buffer // 12 bytes
  authTag: Buffer // 16 bytes
  ciphertext: Buffer
}

const ALG = 'aes-256-gcm'
const WRAP_VERSION = 0x01

let masterKey: Buffer | null = null

function parseKey(b64: string, name: string): Buffer {
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`)
  return key
}

function getMasterKey(): Buffer {
  if (masterKey) return masterKey
  const b64 = process.env.CIMT_MASTER_KEY
  if (!b64) {
    throw new Error(
      'Missing CIMT_MASTER_KEY in .env (generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"). ' +
      'Back it up separately from SQL backups — encrypted incident data is unrecoverable without it.',
    )
  }
  masterKey = parseKey(b64, 'CIMT_MASTER_KEY')
  return masterKey
}

/** During a master-key rotation the old key lives in CIMT_MASTER_KEY_PREVIOUS. */
function getPreviousMasterKey(): Buffer | null {
  const b64 = process.env.CIMT_MASTER_KEY_PREVIOUS
  return b64 ? parseKey(b64, 'CIMT_MASTER_KEY_PREVIOUS') : null
}

/** Generate a fresh incident data key, returned already wrapped for storage. */
export function generateWrappedDataKey(): Buffer {
  return wrapKey(randomBytes(32))
}

export function wrapKey(dataKey: Buffer): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, getMasterKey(), iv)
  const ct = Buffer.concat([cipher.update(dataKey), cipher.final()])
  return Buffer.concat([Buffer.from([WRAP_VERSION]), iv, cipher.getAuthTag(), ct])
}

export function unwrapKey(wrapped: Buffer): Buffer {
  if (wrapped[0] !== WRAP_VERSION) throw new Error(`Unknown data-key wrap version ${wrapped[0]}`)
  const iv = wrapped.subarray(1, 13)
  const tag = wrapped.subarray(13, 29)
  const ct = wrapped.subarray(29)
  const tryKey = (key: Buffer) => {
    const decipher = createDecipheriv(ALG, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()])
  }
  try {
    return tryKey(getMasterKey())
  } catch (err) {
    // Mid-rotation: keys wrapped by the old master still unwrap via _PREVIOUS
    const previous = getPreviousMasterKey()
    if (!previous) throw err
    return tryKey(previous)
  }
}

/** Re-wrap a stored data key under the CURRENT master key (master-key rotation). */
export function rewrapKey(wrapped: Buffer): Buffer {
  return wrapKey(unwrapKey(wrapped))
}

/** AAD binds ciphertext to its incident and table so it can't be transplanted. */
export const aad = (incidentId: number, table: string) =>
  Buffer.from(`incident:${incidentId}:${table}`)

export function encrypt(dataKey: Buffer, plaintext: Buffer, aadBuf: Buffer): EncryptedPayload {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALG, dataKey, iv)
  cipher.setAAD(aadBuf)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { iv, authTag: cipher.getAuthTag(), ciphertext }
}

/** Throws if the auth tag or AAD don't match (tampered/misplaced ciphertext). */
export function decrypt(dataKey: Buffer, payload: EncryptedPayload, aadBuf: Buffer): Buffer {
  const decipher = createDecipheriv(ALG, dataKey, payload.iv)
  decipher.setAAD(aadBuf)
  decipher.setAuthTag(payload.authTag)
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()])
}

// ---------- unwrapped data-key cache (avoid re-unwrapping per message) ----------

const CACHE_TTL_MS = 15 * 60_000
const keyCache = new Map<number, { key: Buffer; expires: number }>()

export function getIncidentDataKey(incidentId: number, wrapped: Buffer): Buffer {
  const hit = keyCache.get(incidentId)
  if (hit && hit.expires > Date.now()) return hit.key
  const key = unwrapKey(wrapped)
  keyCache.set(incidentId, { key, expires: Date.now() + CACHE_TTL_MS })
  return key
}

/** Call after key rotation so the cache can't serve a stale unwrap. */
export function evictIncidentDataKey(incidentId: number): void {
  keyCache.delete(incidentId)
}
