// Creates (or resets the password of) the bootstrap admin user from env vars.
// Usage: set ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env, then `npm run db:seed-admin`.
// Idempotent and additive — never touches other users.
import { getPool, sql } from '../server/src/db.ts'
import { hashPassword } from '../server/src/auth.ts'

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD
const name = process.env.ADMIN_NAME?.trim() || 'Administrator'

if (!email || !password) {
  console.error('Missing ADMIN_EMAIL / ADMIN_PASSWORD in .env')
  process.exit(1)
}
if (password.length < 10) {
  console.error('ADMIN_PASSWORD must be at least 10 characters')
  process.exit(1)
}

const pool = await getPool()
const passwordHash = await hashPassword(password)

const r = await pool.request()
  .input('email', sql.NVarChar(256), email)
  .input('name', sql.NVarChar(200), name)
  .input('hash', sql.NVarChar(300), passwordHash)
  .query(`MERGE dbo.users AS t
          USING (SELECT @email AS email) AS s ON t.email = s.email
          WHEN MATCHED THEN UPDATE SET
            password_hash = @hash, is_admin = 1, is_active = 1, updated_at = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (email, display_name, password_hash, is_admin)
            VALUES (@email, @name, @hash, 1)
          OUTPUT $action AS action;`)

console.log(`Admin ${email}: ${r.recordset[0].action === 'INSERT' ? 'created' : 'password reset'}`)
await pool.close()
