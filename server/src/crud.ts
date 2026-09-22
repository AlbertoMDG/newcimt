import { Router } from 'express'
import type { z } from 'zod'
import { getPool, sql } from './db.ts'
import { badRequest, notFound } from './errors.ts'

export interface CrudConfig {
  table: string
  idColumn: string
  /** insertable/updatable columns -> mssql type */
  columns: Record<string, sql.ISqlType | (() => sql.ISqlType)>
  /** create schema; .partial() is applied for updates */
  schema: z.ZodObject<z.ZodRawShape>
  /** query param name -> column for equality filtering on list */
  filters?: Record<string, string>
  orderBy?: string
  hasUpdatedAt?: boolean
}

export function makeCrudRouter(cfg: CrudConfig): Router {
  const router = Router()
  const cols = Object.keys(cfg.columns)

  const bind = (req: sql.Request, data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (!(key in cfg.columns)) continue
      req.input(key, cfg.columns[key], value ?? null)
    }
  }

  router.get('/', async (req, res, next) => {
    try {
      const pool = await getPool()
      const r = pool.request()
      const where: string[] = []
      for (const [param, col] of Object.entries(cfg.filters ?? {})) {
        const v = req.query[param]
        if (v !== undefined && v !== '') {
          r.input(`f_${param}`, String(v))
          where.push(`${col} = @f_${param}`)
        }
      }
      const q = `SELECT * FROM ${cfg.table}${where.length ? ' WHERE ' + where.join(' AND ') : ''}
                 ORDER BY ${cfg.orderBy ?? cfg.idColumn}`
      res.json((await r.query(q)).recordset)
    } catch (e) { next(e) }
  })

  router.get('/:id', async (req, res, next) => {
    try {
      const pool = await getPool()
      const r = await pool.request().input('id', sql.Int, Number(req.params.id))
        .query(`SELECT * FROM ${cfg.table} WHERE ${cfg.idColumn} = @id`)
      if (!r.recordset[0]) throw notFound()
      res.json(r.recordset[0])
    } catch (e) { next(e) }
  })

  router.post('/', async (req, res, next) => {
    try {
      const parsed = cfg.schema.safeParse(req.body)
      if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
      const data = parsed.data as Record<string, unknown>
      const used = cols.filter((c) => c in data)
      const pool = await getPool()
      const r = pool.request()
      bind(r, data)
      const result = await r.query(
        `INSERT INTO ${cfg.table} (${used.join(', ')})
         OUTPUT INSERTED.* VALUES (${used.map((c) => '@' + c).join(', ')})`)
      res.status(201).json(result.recordset[0])
    } catch (e) { next(e) }
  })

  router.put('/:id', async (req, res, next) => {
    try {
      const parsed = cfg.schema.partial().safeParse(req.body)
      if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
      const data = parsed.data as Record<string, unknown>
      const used = cols.filter((c) => c in data)
      if (used.length === 0) throw badRequest('No updatable fields in body')
      const sets = used.map((c) => `${c} = @${c}`)
      if (cfg.hasUpdatedAt) sets.push('updated_at = SYSUTCDATETIME()')
      const pool = await getPool()
      const r = pool.request().input('id', sql.Int, Number(req.params.id))
      bind(r, data)
      const result = await r.query(
        `UPDATE ${cfg.table} SET ${sets.join(', ')}
         OUTPUT INSERTED.* WHERE ${cfg.idColumn} = @id`)
      if (!result.recordset[0]) throw notFound()
      res.json(result.recordset[0])
    } catch (e) { next(e) }
  })

  router.delete('/:id', async (req, res, next) => {
    try {
      const pool = await getPool()
      const result = await pool.request().input('id', sql.Int, Number(req.params.id))
        .query(`DELETE FROM ${cfg.table} WHERE ${cfg.idColumn} = @id`)
      if (result.rowsAffected[0] === 0) throw notFound()
      res.status(204).end()
    } catch (e) { next(e) }
  })

  return router
}
