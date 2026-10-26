// Incident workspaces: lifecycle, membership, and member-gated access.
// Custom router — access control is per-incident membership, not admin CRUD.
import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getPool, sql } from '../db.ts'
import { badRequest, forbidden, notFound } from '../errors.ts'
import { requireAdmin } from '../auth.ts'
import { aad, decrypt, encrypt, evictIncidentDataKey, generateWrappedDataKey, getIncidentDataKey, rewrapKey } from '../crypto.ts'
import { logAudit } from '../audit.ts'
import { broadcast, subscribe } from '../realtime.ts'
import { readBlob, writeBlob } from '../files.ts'
import { streamIncidentExport } from '../export.ts'

export type IncidentRole = 'observer' | 'member' | 'commander'
const ROLE_RANK: Record<IncidentRole, number> = { observer: 0, member: 1, commander: 2 }

interface IncidentRow {
  incident_id: number
  title: string
  incident_type: string
  site_id: number | null
  severity: string
  status: 'active' | 'closed' | 'archived'
  summary: string | null
  data_key: Buffer
  key_version: number
  created_at: Date
  created_by: number
  closed_at: Date | null
  closed_by: number | null
}

declare global {
  namespace Express {
    interface Request {
      incident?: IncidentRow
      incidentRole?: IncidentRole
    }
  }
}

// Everything except data_key — the wrapped key never leaves the server
const INC_COLS = `incident_id, title, incident_type, site_id, severity, status, summary,
  key_version, created_at, created_by, closed_at, closed_by, updated_at`

/**
 * Resolve :id and the caller's membership. Admins pass as commander. Non-members
 * get 404 (not 403) so the incident's existence is not revealed. Insufficient
 * role inside the room gets 403 (the member already knows the room exists).
 */
function requireMember(minRole: IncidentRole) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const incidentId = Number(req.params.id)
      if (!Number.isInteger(incidentId)) throw notFound()
      const pool = await getPool()
      const inc: IncidentRow | undefined = (
        await pool.request().input('id', sql.Int, incidentId)
          .query(`SELECT * FROM dbo.incidents WHERE incident_id = @id`)
      ).recordset[0]
      if (!inc) throw notFound()

      let role: IncidentRole
      if (req.user!.is_admin) {
        role = 'commander'
      } else {
        const m = (
          await pool.request()
            .input('id', sql.Int, incidentId)
            .input('uid', sql.Int, req.user!.user_id)
            .query('SELECT role FROM dbo.incident_members WHERE incident_id = @id AND user_id = @uid')
        ).recordset[0]
        if (!m) throw notFound()
        role = m.role
      }
      if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw forbidden('Your workspace role does not allow this')
      req.incident = inc
      req.incidentRole = role
      next()
    } catch (e) { next(e) }
  }
}

/** Closed/archived rooms are read-only — the legal record is frozen. */
function requireWritable(req: Request, _res: Response, next: NextFunction) {
  if (req.incident!.status !== 'active') {
    return next(badRequest('This workspace is closed and read-only'))
  }
  next()
}

const incidents = Router()

// ---------- encrypted messages ----------

type MessageKind = 'chat' | 'event' | 'decision' | 'system'

interface MessageDto {
  message_id: number
  incident_id: number
  user_id: number
  kind: MessageKind
  body: string
  created_at: Date
  display_name: string
}

/** Encrypt, persist, and broadcast one message. The plaintext never hits the DB. */
async function insertMessage(
  incident: IncidentRow,
  userId: number,
  displayName: string,
  kind: MessageKind,
  body: string,
): Promise<MessageDto> {
  const dataKey = getIncidentDataKey(incident.incident_id, incident.data_key)
  const payload = encrypt(dataKey, Buffer.from(body, 'utf8'), aad(incident.incident_id, 'incident_messages'))
  const pool = await getPool()
  const r = await pool.request()
    .input('incident_id', sql.Int, incident.incident_id)
    .input('user_id', sql.Int, userId)
    .input('kind', sql.NVarChar(16), kind)
    .input('ciphertext', sql.VarBinary(sql.MAX), payload.ciphertext)
    .input('iv', sql.Binary, payload.iv)
    .input('auth_tag', sql.Binary, payload.authTag)
    .input('key_version', sql.Int, incident.key_version)
    .query(`INSERT INTO dbo.incident_messages (incident_id, user_id, kind, ciphertext, iv, auth_tag, key_version)
            OUTPUT INSERTED.message_id, INSERTED.created_at
            VALUES (@incident_id, @user_id, @kind, @ciphertext, @iv, @auth_tag, @key_version)`)
  const row = r.recordset[0]
  const dto: MessageDto = {
    message_id: Number(row.message_id),
    incident_id: incident.incident_id,
    user_id: userId,
    kind,
    body,
    created_at: row.created_at,
    display_name: displayName,
  }
  broadcast(incident.incident_id, 'message', dto, dto.message_id)
  return dto
}

/** Server-generated entries ("X was added") that keep the room's record complete. */
async function postSystemMessage(incident: IncidentRow, req: Request, body: string): Promise<void> {
  await insertMessage(incident, req.user!.user_id, req.user!.display_name, 'system', body)
}

const incidentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  incident_type: z.enum(['food_safety', 'workplace', 'environmental', 'security', 'cyber', 'product_recall', 'other']),
  site_id: z.coerce.number().int().nullable().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  summary: z.string().trim().max(1_000_000).nullable().optional().transform((v) => (v === '' ? null : v ?? null)),
})

// ---------- list / create ----------

incidents.get('/', async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = pool.request().input('uid', sql.Int, req.user!.user_id)
    const q = req.user!.is_admin
      ? `SELECT ${INC_COLS},
           (SELECT COUNT(*) FROM dbo.incident_members m WHERE m.incident_id = i.incident_id) AS member_count,
           (SELECT role FROM dbo.incident_members m WHERE m.incident_id = i.incident_id AND m.user_id = @uid) AS my_role
         FROM dbo.incidents i
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END, created_at DESC`
      : `SELECT ${INC_COLS},
           (SELECT COUNT(*) FROM dbo.incident_members m2 WHERE m2.incident_id = i.incident_id) AS member_count,
           m.role AS my_role
         FROM dbo.incidents i
         JOIN dbo.incident_members m ON m.incident_id = i.incident_id AND m.user_id = @uid
         ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END, created_at DESC`
    res.json((await r.query(q)).recordset)
  } catch (e) { next(e) }
})

incidents.post('/', requireAdmin, async (req, res, next) => {
  try {
    const parsed = incidentSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const d = parsed.data

    const pool = await getPool()
    const r = await pool.request()
      .input('title', sql.NVarChar(200), d.title)
      .input('incident_type', sql.NVarChar(32), d.incident_type)
      .input('site_id', sql.Int, d.site_id ?? null)
      .input('severity', sql.NVarChar(16), d.severity)
      .input('summary', sql.NVarChar(sql.MAX), d.summary)
      .input('data_key', sql.VarBinary(256), generateWrappedDataKey())
      .input('created_by', sql.Int, req.user!.user_id)
      .input('updated_by', sql.NVarChar(256), req.user!.email)
      .query(`INSERT INTO dbo.incidents
                (title, incident_type, site_id, severity, summary, data_key, created_by, updated_by)
              OUTPUT INSERTED.incident_id
              VALUES (@title, @incident_type, @site_id, @severity, @summary, @data_key, @created_by, @updated_by)`)
    const id: number = r.recordset[0].incident_id

    // The creator starts as commander so the room is never ownerless
    await pool.request()
      .input('incident_id', sql.Int, id)
      .input('user_id', sql.Int, req.user!.user_id)
      .input('added_by', sql.Int, req.user!.user_id)
      .query(`INSERT INTO dbo.incident_members (incident_id, user_id, role, added_by)
              VALUES (@incident_id, @user_id, 'commander', @added_by)`)

    await logAudit(id, req.user!.user_id, 'incident_created', { title: d.title, incident_type: d.incident_type, severity: d.severity })
    await logAudit(id, req.user!.user_id, 'member_added', { user_id: req.user!.user_id, role: 'commander', email: req.user!.email })

    const row = await pool.request().input('id', sql.Int, id)
      .query(`SELECT ${INC_COLS} FROM dbo.incidents WHERE incident_id = @id`)
    res.status(201).json(row.recordset[0])
  } catch (e) { next(e) }
})

// ---------- read / update / lifecycle ----------

incidents.get('/:id', requireMember('observer'), (req, res) => {
  const { data_key: _dataKey, ...safe } = req.incident!
  res.json({ ...safe, my_role: req.incidentRole })
})

incidents.put('/:id', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const parsed = incidentSchema.partial().safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const d = parsed.data

    const sets: string[] = ['updated_at = SYSUTCDATETIME()', 'updated_by = @updated_by']
    const pool = await getPool()
    const r = pool.request()
      .input('id', sql.Int, req.incident!.incident_id)
      .input('updated_by', sql.NVarChar(256), req.user!.email)
    if (d.title !== undefined) { sets.push('title = @title'); r.input('title', sql.NVarChar(200), d.title) }
    if (d.incident_type !== undefined) { sets.push('incident_type = @incident_type'); r.input('incident_type', sql.NVarChar(32), d.incident_type) }
    if (d.site_id !== undefined) { sets.push('site_id = @site_id'); r.input('site_id', sql.Int, d.site_id) }
    if (d.severity !== undefined) { sets.push('severity = @severity'); r.input('severity', sql.NVarChar(16), d.severity) }
    if (d.summary !== undefined) { sets.push('summary = @summary'); r.input('summary', sql.NVarChar(sql.MAX), d.summary) }

    const result = await r.query(`UPDATE dbo.incidents SET ${sets.join(', ')} WHERE incident_id = @id;
                                  SELECT ${INC_COLS} FROM dbo.incidents WHERE incident_id = @id`)
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'incident_updated', d)
    res.json(result.recordset[0])
  } catch (e) { next(e) }
})

async function setStatus(req: Request, to: 'active' | 'closed' | 'archived') {
  const pool = await getPool()
  const closing = to === 'closed'
  const reopening = to === 'active'
  await pool.request()
    .input('id', sql.Int, req.incident!.incident_id)
    .input('status', sql.NVarChar(16), to)
    .input('by', sql.Int, req.user!.user_id)
    .input('updated_by', sql.NVarChar(256), req.user!.email)
    .query(`UPDATE dbo.incidents SET status = @status,
              closed_at = ${closing ? 'SYSUTCDATETIME()' : reopening ? 'NULL' : 'closed_at'},
              closed_by = ${closing ? '@by' : reopening ? 'NULL' : 'closed_by'},
              updated_at = SYSUTCDATETIME(), updated_by = @updated_by
            WHERE incident_id = @id`)
  await logAudit(req.incident!.incident_id, req.user!.user_id, 'status_changed',
    { from: req.incident!.status, to })
  const verb = to === 'active' ? 'reopened' : to
  await postSystemMessage(req.incident!, req, `Workspace ${verb} by ${req.user!.display_name}`)
  broadcast(req.incident!.incident_id, 'incident', { incident_id: req.incident!.incident_id, status: to })
  const row = await pool.request().input('id', sql.Int, req.incident!.incident_id)
    .query(`SELECT ${INC_COLS} FROM dbo.incidents WHERE incident_id = @id`)
  return row.recordset[0]
}

incidents.post('/:id/close', requireMember('commander'), async (req, res, next) => {
  try {
    if (req.incident!.status !== 'active') throw badRequest('Only an active workspace can be closed')
    res.json(await setStatus(req, 'closed'))
  } catch (e) { next(e) }
})

incidents.post('/:id/archive', requireAdmin, requireMember('commander'), async (req, res, next) => {
  try {
    if (req.incident!.status !== 'closed') throw badRequest('Only a closed workspace can be archived')
    res.json(await setStatus(req, 'archived'))
  } catch (e) { next(e) }
})

// Reopen: admin-only, always audited (the record shows the room was reopened)
incidents.post('/:id/reopen', requireAdmin, requireMember('commander'), async (req, res, next) => {
  try {
    if (req.incident!.status === 'active') throw badRequest('This workspace is already active')
    res.json(await setStatus(req, 'active'))
  } catch (e) { next(e) }
})

// ---------- chat: stream + history + post ----------

incidents.get('/:id/stream', requireMember('observer'), (req, res) => {
  subscribe(req.incident!.incident_id, req, res)
})

incidents.get('/:id/messages', requireMember('observer'), async (req, res, next) => {
  try {
    const after = req.query.after !== undefined ? Number(req.query.after) : null
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500)
    if (after !== null && !Number.isInteger(after)) throw badRequest('Invalid after cursor')

    const pool = await getPool()
    const r = pool.request()
      .input('id', sql.Int, req.incident!.incident_id)
      .input('limit', sql.Int, limit)
    const q = after !== null
      ? `SELECT TOP (@limit) m.message_id, m.user_id, m.kind, m.ciphertext, m.iv, m.auth_tag, m.created_at,
                u.display_name
         FROM dbo.incident_messages m JOIN dbo.users u ON u.user_id = m.user_id
         WHERE m.incident_id = @id AND m.message_id > @after
         ORDER BY m.message_id`
      : `SELECT message_id, user_id, kind, ciphertext, iv, auth_tag, created_at, display_name FROM (
           SELECT TOP (@limit) m.message_id, m.user_id, m.kind, m.ciphertext, m.iv, m.auth_tag, m.created_at,
                  u.display_name
           FROM dbo.incident_messages m JOIN dbo.users u ON u.user_id = m.user_id
           WHERE m.incident_id = @id
           ORDER BY m.message_id DESC
         ) latest ORDER BY message_id`
    if (after !== null) r.input('after', sql.BigInt, after)

    const dataKey = getIncidentDataKey(req.incident!.incident_id, req.incident!.data_key)
    const aadBuf = aad(req.incident!.incident_id, 'incident_messages')
    const messages: MessageDto[] = (await r.query(q)).recordset.map((row: {
      message_id: unknown; user_id: number; kind: MessageKind; ciphertext: Buffer
      iv: Buffer; auth_tag: Buffer; created_at: Date; display_name: string
    }) => ({
      message_id: Number(row.message_id),
      incident_id: req.incident!.incident_id,
      user_id: row.user_id,
      kind: row.kind,
      body: decrypt(dataKey, { iv: row.iv, authTag: row.auth_tag, ciphertext: row.ciphertext }, aadBuf).toString('utf8'),
      created_at: row.created_at,
      display_name: row.display_name,
    }))
    res.json(messages)
  } catch (e) { next(e) }
})

const messageSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  kind: z.enum(['chat', 'event', 'decision']).default('chat'),
})

incidents.post('/:id/messages', requireMember('member'), requireWritable, async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const { body, kind } = parsed.data
    // Formal entries are the coordinator's record — commanders only
    if (kind !== 'chat' && req.incidentRole !== 'commander') {
      throw forbidden('Only a commander can log events and decisions')
    }
    const dto = await insertMessage(req.incident!, req.user!.user_id, req.user!.display_name, kind, body)
    await logAudit(req.incident!.incident_id, req.user!.user_id,
      kind === 'chat' ? 'message_posted' : 'decision_logged',
      { message_id: dto.message_id, kind })
    res.status(201).json(dto)
  } catch (e) { next(e) }
})

// ---------- audit trail + record export ----------

incidents.get('/:id/audit', requireMember('commander'), async (req, res, next) => {
  try {
    const action = typeof req.query.action === 'string' && req.query.action !== '' ? req.query.action : null
    const pool = await getPool()
    const r = pool.request().input('id', sql.Int, req.incident!.incident_id)
    if (action) r.input('action', sql.NVarChar(40), action)
    const rows = (await r.query(
      `SELECT a.audit_id, a.incident_id, a.user_id, a.action, a.detail, a.created_at,
              u.display_name AS actor_name
       FROM dbo.incident_audit a
       LEFT JOIN dbo.users u ON u.user_id = a.user_id
       WHERE a.incident_id = @id${action ? ' AND a.action = @action' : ''}
       ORDER BY a.audit_id`)).recordset
    res.json(rows.map((a: { audit_id: unknown }) => ({ ...a, audit_id: Number(a.audit_id) })))
  } catch (e) { next(e) }
})

// The complete incident record as a ZIP. Closed/archived rooms only — the
// record is frozen before it's handed over. The export itself is audited.
incidents.post('/:id/export', requireMember('commander'), async (req, res, next) => {
  try {
    if (req.incident!.status === 'active') {
      throw badRequest('Close the workspace before exporting its record')
    }
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'export_generated', {})
    await streamIncidentExport(req, res)
  } catch (e) { next(e) }
})

// Re-wrap this incident's data key under the current master key. Message/file
// ciphertext is untouched — only the key's envelope changes.
incidents.post('/:id/rotate-key', requireAdmin, requireMember('commander'), async (req, res, next) => {
  try {
    const rewrapped = rewrapKey(req.incident!.data_key)
    const pool = await getPool()
    const r = await pool.request()
      .input('id', sql.Int, req.incident!.incident_id)
      .input('dk', sql.VarBinary(256), rewrapped)
      .input('updated_by', sql.NVarChar(256), req.user!.email)
      .query(`UPDATE dbo.incidents
              SET data_key = @dk, key_version = key_version + 1,
                  updated_at = SYSUTCDATETIME(), updated_by = @updated_by
              OUTPUT INSERTED.key_version
              WHERE incident_id = @id`)
    evictIncidentDataKey(req.incident!.incident_id)
    const keyVersion = r.recordset[0].key_version
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'key_rotated', { key_version: keyVersion })
    res.json({ ok: true, key_version: keyVersion })
  } catch (e) { next(e) }
})

// ---------- members ----------

incidents.get('/:id/members', requireMember('observer'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.Int, req.incident!.incident_id)
      .query(`SELECT m.member_id, m.incident_id, m.user_id, m.role, m.added_at,
                     u.display_name, u.email
              FROM dbo.incident_members m
              JOIN dbo.users u ON u.user_id = m.user_id
              WHERE m.incident_id = @id
              ORDER BY CASE m.role WHEN 'commander' THEN 0 WHEN 'member' THEN 1 ELSE 2 END, u.display_name`)
    res.json(r.recordset)
  } catch (e) { next(e) }
})

const memberSchema = z.object({
  user_id: z.coerce.number().int(),
  role: z.enum(['commander', 'member', 'observer']).default('member'),
})

incidents.post('/:id/members', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const parsed = memberSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const { user_id, role } = parsed.data

    const pool = await getPool()
    const target = (await pool.request().input('uid', sql.Int, user_id)
      .query('SELECT user_id, email, display_name FROM dbo.users WHERE user_id = @uid AND is_active = 1')).recordset[0]
    if (!target) throw badRequest('Unknown or inactive user')

    try {
      await pool.request()
        .input('incident_id', sql.Int, req.incident!.incident_id)
        .input('user_id', sql.Int, user_id)
        .input('role', sql.NVarChar(16), role)
        .input('added_by', sql.Int, req.user!.user_id)
        .query(`INSERT INTO dbo.incident_members (incident_id, user_id, role, added_by)
                VALUES (@incident_id, @user_id, @role, @added_by)`)
    } catch (err: unknown) {
      if (typeof err === 'object' && err && 'number' in err && (err as { number: number }).number === 2627) {
        throw badRequest('That user is already a member of this workspace')
      }
      throw err
    }
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'member_added',
      { user_id, role, email: target.email })
    await postSystemMessage(req.incident!, req, `${target.display_name} was added as ${role}`)
    res.status(201).json({ ok: true })
  } catch (e) { next(e) }
})

/** A room must keep at least one commander so members can still be managed. */
async function isLastCommander(incidentId: number, memberId: number): Promise<boolean> {
  const pool = await getPool()
  const r = await pool.request()
    .input('id', sql.Int, incidentId)
    .input('mid', sql.Int, memberId)
    .query(`SELECT
              (SELECT COUNT(*) FROM dbo.incident_members WHERE incident_id = @id AND role = 'commander') AS commanders,
              (SELECT role FROM dbo.incident_members WHERE member_id = @mid) AS target_role`)
  const row = r.recordset[0]
  return row.target_role === 'commander' && row.commanders <= 1
}

incidents.put('/:id/members/:memberId', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const parsed = z.object({ role: z.enum(['commander', 'member', 'observer']) }).safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const memberId = Number(req.params.memberId)
    if (parsed.data.role !== 'commander' && await isLastCommander(req.incident!.incident_id, memberId)) {
      throw badRequest('This is the only commander — assign another commander first')
    }
    const pool = await getPool()
    const r = await pool.request()
      .input('mid', sql.Int, memberId)
      .input('id', sql.Int, req.incident!.incident_id)
      .input('role', sql.NVarChar(16), parsed.data.role)
      .query(`UPDATE m SET m.role = @role
              OUTPUT INSERTED.user_id, u.display_name
              FROM dbo.incident_members m JOIN dbo.users u ON u.user_id = m.user_id
              WHERE m.member_id = @mid AND m.incident_id = @id`)
    if (!r.recordset[0]) throw notFound()
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'role_changed',
      { member_id: memberId, user_id: r.recordset[0].user_id, role: parsed.data.role })
    await postSystemMessage(req.incident!, req, `${r.recordset[0].display_name} is now ${parsed.data.role}`)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

incidents.delete('/:id/members/:memberId', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const memberId = Number(req.params.memberId)
    if (await isLastCommander(req.incident!.incident_id, memberId)) {
      throw badRequest('This is the only commander — assign another commander first')
    }
    const pool = await getPool()
    const r = await pool.request()
      .input('mid', sql.Int, memberId)
      .input('id', sql.Int, req.incident!.incident_id)
      .query(`DELETE m
              OUTPUT DELETED.user_id, u.display_name
              FROM dbo.incident_members m JOIN dbo.users u ON u.user_id = m.user_id
              WHERE m.member_id = @mid AND m.incident_id = @id`)
    if (!r.recordset[0]) throw notFound()
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'member_removed',
      { member_id: memberId, user_id: r.recordset[0].user_id })
    await postSystemMessage(req.incident!, req, `${r.recordset[0].display_name} was removed`)
    res.status(204).end()
  } catch (e) { next(e) }
})

// ---------- folders ----------

const folderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parent_folder_id: z.coerce.number().int().nullable().optional(),
})

/** Resolve a folder id within this incident; null input passes through (root). */
async function checkFolder(incidentId: number, folderId: number | null | undefined): Promise<number | null> {
  if (folderId === null || folderId === undefined) return null
  const pool = await getPool()
  const r = await pool.request()
    .input('fid', sql.Int, folderId)
    .input('id', sql.Int, incidentId)
    .query('SELECT folder_id FROM dbo.incident_folders WHERE folder_id = @fid AND incident_id = @id')
  if (!r.recordset[0]) throw badRequest('Unknown folder')
  return folderId
}

incidents.get('/:id/folders', requireMember('observer'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.Int, req.incident!.incident_id)
      .query(`SELECT folder_id, incident_id, parent_folder_id, name, created_at, created_by
              FROM dbo.incident_folders WHERE incident_id = @id ORDER BY name`)
    res.json(r.recordset)
  } catch (e) { next(e) }
})

incidents.post('/:id/folders', requireMember('member'), requireWritable, async (req, res, next) => {
  try {
    const parsed = folderSchema.safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const parentId = await checkFolder(req.incident!.incident_id, parsed.data.parent_folder_id)

    const pool = await getPool()
    const r = await pool.request()
      .input('id', sql.Int, req.incident!.incident_id)
      .input('parent', sql.Int, parentId)
      .input('name', sql.NVarChar(255), parsed.data.name)
      .input('by', sql.Int, req.user!.user_id)
      .query(`INSERT INTO dbo.incident_folders (incident_id, parent_folder_id, name, created_by)
              OUTPUT INSERTED.*
              VALUES (@id, @parent, @name, @by)`)
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'folder_created',
      { folder_id: r.recordset[0].folder_id, name: parsed.data.name })
    broadcast(req.incident!.incident_id, 'files', {})
    res.status(201).json(r.recordset[0])
  } catch (e) { next(e) }
})

incidents.put('/:id/folders/:folderId', requireMember('member'), requireWritable, async (req, res, next) => {
  try {
    const parsed = folderSchema.partial().safeParse(req.body)
    if (!parsed.success) throw badRequest('Validation failed', parsed.error.issues)
    const folderId = Number(req.params.folderId)
    const pool = await getPool()

    const sets: string[] = []
    const r = pool.request()
      .input('fid', sql.Int, folderId)
      .input('id', sql.Int, req.incident!.incident_id)
    if (parsed.data.name !== undefined) { sets.push('name = @name'); r.input('name', sql.NVarChar(255), parsed.data.name) }
    if (parsed.data.parent_folder_id !== undefined) {
      const parentId = await checkFolder(req.incident!.incident_id, parsed.data.parent_folder_id)
      if (parentId !== null) {
        // No cycles: walk up from the new parent; a small tree makes this cheap
        let cursor: number | null = parentId
        while (cursor !== null) {
          if (cursor === folderId) throw badRequest('Cannot move a folder into itself')
          const row: { parent_folder_id: number | null } | undefined = (
            await pool.request().input('c', sql.Int, cursor)
              .query('SELECT parent_folder_id FROM dbo.incident_folders WHERE folder_id = @c')
          ).recordset[0]
          cursor = row?.parent_folder_id ?? null
        }
      }
      sets.push('parent_folder_id = @parent')
      r.input('parent', sql.Int, parentId)
    }
    if (sets.length === 0) throw badRequest('Nothing to change')

    const result = await r.query(`UPDATE dbo.incident_folders SET ${sets.join(', ')}
                                  OUTPUT INSERTED.*
                                  WHERE folder_id = @fid AND incident_id = @id`)
    if (!result.recordset[0]) throw notFound()
    broadcast(req.incident!.incident_id, 'files', {})
    res.json(result.recordset[0])
  } catch (e) { next(e) }
})

// Folders with any content (files — soft-deleted included — or subfolders) stay forever
incidents.delete('/:id/folders/:folderId', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const folderId = Number(req.params.folderId)
    const pool = await getPool()
    const counts = (await pool.request()
      .input('fid', sql.Int, folderId)
      .input('id', sql.Int, req.incident!.incident_id)
      .query(`SELECT
                (SELECT COUNT(*) FROM dbo.incident_files WHERE folder_id = @fid) AS files,
                (SELECT COUNT(*) FROM dbo.incident_folders WHERE parent_folder_id = @fid) AS subfolders`)
    ).recordset[0]
    if (counts.files > 0 || counts.subfolders > 0) {
      throw badRequest('Only empty folders can be deleted — the incident record keeps everything else')
    }
    const r = await pool.request()
      .input('fid', sql.Int, folderId)
      .input('id', sql.Int, req.incident!.incident_id)
      .query('DELETE FROM dbo.incident_folders WHERE folder_id = @fid AND incident_id = @id')
    if (r.rowsAffected[0] === 0) throw notFound()
    broadcast(req.incident!.incident_id, 'files', {})
    res.status(204).end()
  } catch (e) { next(e) }
})

// ---------- files ----------

const MAX_FILE_BYTES = 50 * 1024 * 1024
// Executables are refused; everything else (photos, PDFs, .msg, spreadsheets) is fair game
const BLOCKED_EXT = new Set(['.exe', '.dll', '.bat', '.cmd', '.ps1', '.js', '.msi', '.scr', '.vbs', '.com'])

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } })
function uploadSingle(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
      return next(badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 50 MB' : err.message))
    }
    next(err)
  })
}

const FILE_COLS = `f.file_id, f.incident_id, f.folder_id, f.original_name, f.content_type,
  f.size_bytes, f.uploaded_at, f.uploaded_by, u.display_name AS uploader_name`

incidents.get('/:id/files', requireMember('observer'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.Int, req.incident!.incident_id)
      .query(`SELECT ${FILE_COLS}
              FROM dbo.incident_files f JOIN dbo.users u ON u.user_id = f.uploaded_by
              WHERE f.incident_id = @id AND f.deleted_at IS NULL
              ORDER BY f.original_name`)
    res.json(r.recordset)
  } catch (e) { next(e) }
})

incidents.post('/:id/files', requireMember('member'), requireWritable, uploadSingle, async (req, res, next) => {
  try {
    const file = req.file
    if (!file) throw badRequest('No file provided (multipart field "file")')
    const name = file.originalname.normalize()
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
    if (BLOCKED_EXT.has(ext)) throw badRequest(`Executable files are not allowed (${ext})`)
    const folderId = await checkFolder(
      req.incident!.incident_id,
      req.body.folder_id === '' || req.body.folder_id === undefined ? null : Number(req.body.folder_id),
    )

    const sha256 = createHash('sha256').update(file.buffer).digest()
    const dataKey = getIncidentDataKey(req.incident!.incident_id, req.incident!.data_key)
    const payload = encrypt(dataKey, file.buffer, aad(req.incident!.incident_id, 'incident_files'))
    const storageName = `${randomUUID()}.bin`
    await writeBlob(req.incident!.incident_id, storageName, payload.ciphertext)

    const pool = await getPool()
    const r = await pool.request()
      .input('id', sql.Int, req.incident!.incident_id)
      .input('folder_id', sql.Int, folderId)
      .input('original_name', sql.NVarChar(255), name.slice(0, 255))
      .input('content_type', sql.NVarChar(127), file.mimetype?.slice(0, 127) ?? null)
      .input('size_bytes', sql.BigInt, file.size)
      .input('storage_name', sql.NVarChar(64), storageName)
      .input('iv', sql.Binary, payload.iv)
      .input('auth_tag', sql.Binary, payload.authTag)
      .input('key_version', sql.Int, req.incident!.key_version)
      .input('sha256', sql.Binary, sha256)
      .input('by', sql.Int, req.user!.user_id)
      .query(`INSERT INTO dbo.incident_files
                (incident_id, folder_id, original_name, content_type, size_bytes, storage_name,
                 iv, auth_tag, key_version, sha256, uploaded_by)
              OUTPUT INSERTED.file_id
              VALUES (@id, @folder_id, @original_name, @content_type, @size_bytes, @storage_name,
                 @iv, @auth_tag, @key_version, @sha256, @by)`)
    const fileId = r.recordset[0].file_id

    await logAudit(req.incident!.incident_id, req.user!.user_id, 'file_uploaded',
      { file_id: fileId, name, size_bytes: file.size, sha256: sha256.toString('hex') })
    await postSystemMessage(req.incident!, req, `${req.user!.display_name} uploaded “${name}”`)
    broadcast(req.incident!.incident_id, 'files', {})

    const row = await pool.request().input('fid', sql.Int, fileId)
      .query(`SELECT ${FILE_COLS} FROM dbo.incident_files f
              JOIN dbo.users u ON u.user_id = f.uploaded_by WHERE f.file_id = @fid`)
    res.status(201).json(row.recordset[0])
  } catch (e) { next(e) }
})

incidents.get('/:id/files/:fileId/download', requireMember('observer'), async (req, res, next) => {
  try {
    const pool = await getPool()
    const row = (await pool.request()
      .input('fid', sql.Int, Number(req.params.fileId))
      .input('id', sql.Int, req.incident!.incident_id)
      .query(`SELECT * FROM dbo.incident_files
              WHERE file_id = @fid AND incident_id = @id AND deleted_at IS NULL`)).recordset[0]
    if (!row) throw notFound()

    const ciphertext = await readBlob(req.incident!.incident_id, row.storage_name)
    const dataKey = getIncidentDataKey(req.incident!.incident_id, req.incident!.data_key)
    // decrypt verifies the GCM tag — a tampered blob throws instead of downloading
    const plaintext = decrypt(dataKey,
      { iv: row.iv, authTag: row.auth_tag, ciphertext },
      aad(req.incident!.incident_id, 'incident_files'))

    await logAudit(req.incident!.incident_id, req.user!.user_id, 'file_downloaded',
      { file_id: row.file_id, name: row.original_name })

    res.setHeader('Content-Type', row.content_type ?? 'application/octet-stream')
    res.setHeader('Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(row.original_name)}`)
    res.send(plaintext)
  } catch (e) { next(e) }
})

incidents.delete('/:id/files/:fileId', requireMember('commander'), requireWritable, async (req, res, next) => {
  try {
    const pool = await getPool()
    const r = await pool.request()
      .input('fid', sql.Int, Number(req.params.fileId))
      .input('id', sql.Int, req.incident!.incident_id)
      .input('by', sql.Int, req.user!.user_id)
      .query(`UPDATE dbo.incident_files SET deleted_at = SYSUTCDATETIME(), deleted_by = @by
              OUTPUT INSERTED.original_name
              WHERE file_id = @fid AND incident_id = @id AND deleted_at IS NULL`)
    if (!r.recordset[0]) throw notFound()
    await logAudit(req.incident!.incident_id, req.user!.user_id, 'file_deleted',
      { file_id: Number(req.params.fileId), name: r.recordset[0].original_name })
    await postSystemMessage(req.incident!, req,
      `${req.user!.display_name} removed “${r.recordset[0].original_name}”`)
    broadcast(req.incident!.incident_id, 'files', {})
    res.status(204).end()
  } catch (e) { next(e) }
})

export default incidents
