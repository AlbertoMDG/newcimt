// Admin-managed user accounts. Custom router (not makeCrudRouter) so the
// password hash never leaves the server and passwords are hashed on write.
import { Router } from 'express'
import { z } from 'zod'
import { getPool, sql } from '../db.ts'
import { badRequest, notFound } from '../errors.ts'
import { hashPassword } from '../auth.ts'

const users = Router()

const SAFE_COLS = 'user_id, email, display_name, entra_oid, is_admin, is_active, created_at, last_login_at, updated_at'

const baseSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(256),
  display_name: z.string().trim().min(1).max(200),
  // Optional on both create and update; blank means "unchanged" (or SSO-only account)
  password: z.string().min(10).max(200).nullable().optional()
    .or(z.literal('').transform(() => null)),
  is_admin: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
})

users.get('/', async (_req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().query(`SELECT ${SAFE_COLS} FROM dbo.users ORDER BY display_name`)
    res.json(r.recordset)
  } catch (e) { next(e) }
})

users.get('/:id', async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.Int, Number(req.params.id))
      .query(`SELECT ${SAFE_COLS} FROM dbo.users WHERE user_id = @id`)
    if (!r.recordset[0]) throw notFound()
    res.json(r.recordset[0])
  } catch (e) { next(e) }
})

users.post('/', async (req, res, next) => {
  try {
    const parsed = baseSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const { email, display_name, password, is_admin, is_active } = parsed.data
    const hash = password ? await hashPassword(password) : null

    const pool = await getPool()
    const r = await pool.request()
      .input('email', sql.NVarChar(256), email)
      .input('display_name', sql.NVarChar(200), display_name)
      .input('hash', sql.NVarChar(300), hash)
      .input('is_admin', sql.Bit, is_admin)
      .input('is_active', sql.Bit, is_active)
      .input('updated_by', sql.NVarChar(256), req.user?.email ?? null)
      .query(`INSERT INTO dbo.users (email, display_name, password_hash, is_admin, is_active, updated_by)
              OUTPUT INSERTED.user_id
              VALUES (@email, @display_name, @hash, @is_admin, @is_active, @updated_by)`)
    const id = r.recordset[0].user_id
    const row = await pool.request().input('id', sql.Int, id)
      .query(`SELECT ${SAFE_COLS} FROM dbo.users WHERE user_id = @id`)
    res.status(201).json(row.recordset[0])
  } catch (e) { next(e) }
})

users.put('/:id', async (req, res, next) => {
  try {
    const parsed = baseSchema.partial().safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const data = parsed.data
    const id = Number(req.params.id)

    // Last-admin guard: don't let the only admin demote or deactivate themselves
    if ((data.is_admin === false || data.is_active === false) && req.user?.user_id === id) {
      const pool = await getPool()
      const admins = await pool.request()
        .query('SELECT COUNT(*) AS n FROM dbo.users WHERE is_admin = 1 AND is_active = 1')
      if (admins.recordset[0].n <= 1) {
        throw badRequest('You are the only active admin — add another admin first')
      }
    }

    const sets: string[] = ['updated_at = SYSUTCDATETIME()', 'updated_by = @updated_by']
    const pool = await getPool()
    const r = pool.request()
      .input('id', sql.Int, id)
      .input('updated_by', sql.NVarChar(256), req.user?.email ?? null)
    if (data.email !== undefined) { sets.push('email = @email'); r.input('email', sql.NVarChar(256), data.email) }
    if (data.display_name !== undefined) { sets.push('display_name = @display_name'); r.input('display_name', sql.NVarChar(200), data.display_name) }
    if (data.is_admin !== undefined) { sets.push('is_admin = @is_admin'); r.input('is_admin', sql.Bit, data.is_admin) }
    if (data.is_active !== undefined) { sets.push('is_active = @is_active'); r.input('is_active', sql.Bit, data.is_active) }
    if (data.password) { sets.push('password_hash = @hash'); r.input('hash', sql.NVarChar(300), await hashPassword(data.password)) }

    const result = await r.query(`UPDATE dbo.users SET ${sets.join(', ')} WHERE user_id = @id;
                                  SELECT ${SAFE_COLS} FROM dbo.users WHERE user_id = @id`)
    if (!result.recordset[0]) throw notFound()
    res.json(result.recordset[0])
  } catch (e) { next(e) }
})

users.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (req.user?.user_id === id) throw badRequest('You cannot delete your own account')
    const pool = await getPool()
    try {
      const r = await pool.request().input('id', sql.Int, id)
        .query('DELETE FROM dbo.users WHERE user_id = @id')
      if (r.rowsAffected[0] === 0) throw notFound()
      res.status(204).end()
    } catch (err: unknown) {
      // FK violation: the user has incident history — the legal record keeps them
      if (typeof err === 'object' && err && 'number' in err && (err as { number: number }).number === 547) {
        throw badRequest('This user has incident history and cannot be deleted — deactivate them instead')
      }
      throw err
    }
  } catch (e) { next(e) }
})

export default users
