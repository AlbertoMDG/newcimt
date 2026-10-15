// Incident-record export: streams a ZIP with the decrypted transcript (HTML +
// CSV), the audit trail, every document (soft-deleted included — it's a legal
// record), and a manifest with chain-of-custody hashes. Nothing touches disk.
import { ZipArchive } from 'archiver'
import type { Request, Response } from 'express'
import { getPool, sql } from './db.ts'
import { aad, decrypt, getIncidentDataKey } from './crypto.ts'
import { readBlob } from './files.ts'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const csv = (rows: (string | number | null)[][]): string =>
  rows.map((r) => r.map((f) => `"${String(f ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : '')

export async function streamIncidentExport(req: Request, res: Response): Promise<void> {
  const incident = req.incident!
  const incidentId = incident.incident_id
  const pool = await getPool()
  const dataKey = getIncidentDataKey(incidentId, incident.data_key)

  const members = (await pool.request().input('id', sql.Int, incidentId)
    .query(`SELECT m.role, m.added_at, u.display_name, u.email
            FROM dbo.incident_members m JOIN dbo.users u ON u.user_id = m.user_id
            WHERE m.incident_id = @id ORDER BY m.added_at`)).recordset

  const msgAad = aad(incidentId, 'incident_messages')
  const messages = (await pool.request().input('id', sql.Int, incidentId)
    .query(`SELECT m.message_id, m.kind, m.ciphertext, m.iv, m.auth_tag, m.created_at, u.display_name
            FROM dbo.incident_messages m JOIN dbo.users u ON u.user_id = m.user_id
            WHERE m.incident_id = @id ORDER BY m.message_id`)).recordset
    .map((m: { message_id: unknown; kind: string; ciphertext: Buffer; iv: Buffer; auth_tag: Buffer; created_at: Date; display_name: string }) => ({
      message_id: Number(m.message_id),
      kind: m.kind,
      created_at: m.created_at,
      display_name: m.display_name,
      body: decrypt(dataKey, { iv: m.iv, authTag: m.auth_tag, ciphertext: m.ciphertext }, msgAad).toString('utf8'),
    }))

  const audit = (await pool.request().input('id', sql.Int, incidentId)
    .query(`SELECT a.audit_id, a.action, a.detail, a.created_at, u.display_name
            FROM dbo.incident_audit a LEFT JOIN dbo.users u ON u.user_id = a.user_id
            WHERE a.incident_id = @id ORDER BY a.audit_id`)).recordset

  const folders = (await pool.request().input('id', sql.Int, incidentId)
    .query('SELECT folder_id, parent_folder_id, name FROM dbo.incident_folders WHERE incident_id = @id')).recordset
  const folderPath = (folderId: number | null): string => {
    const parts: string[] = []
    let cursor = folderId
    while (cursor !== null) {
      const f = folders.find((x: { folder_id: number }) => x.folder_id === cursor)
      if (!f) break
      parts.unshift(f.name.replace(/[\\/:*?"<>|]/g, '_'))
      cursor = f.parent_folder_id
    }
    return parts.join('/')
  }

  const files = (await pool.request().input('id', sql.Int, incidentId)
    .query(`SELECT f.*, u.display_name AS uploader_name
            FROM dbo.incident_files f JOIN dbo.users u ON u.user_id = f.uploaded_by
            WHERE f.incident_id = @id ORDER BY f.file_id`)).recordset

  // ---------- stream the ZIP ----------
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(`incident-${incidentId}-record-${stamp}.zip`)}`)

  const archive = new ZipArchive({ zlib: { level: 9 } })
  archive.on('error', () => res.destroy())
  archive.pipe(res)

  archive.append(JSON.stringify({
    exported_at: new Date().toISOString(),
    exported_by: { user_id: req.user!.user_id, email: req.user!.email, name: req.user!.display_name },
    incident: {
      incident_id: incidentId,
      title: incident.title,
      incident_type: incident.incident_type,
      site_id: incident.site_id,
      severity: incident.severity,
      status: incident.status,
      summary: incident.summary,
      created_at: iso(incident.created_at),
      closed_at: iso(incident.closed_at),
    },
    members,
    counts: { messages: messages.length, audit_entries: audit.length, files: files.length },
    file_hashes: files.map((f: { file_id: number; original_name: string; sha256: Buffer }) => ({
      file_id: f.file_id, original_name: f.original_name, sha256: f.sha256.toString('hex'),
    })),
  }, null, 2), { name: 'manifest.json' })

  // Printable transcript — "print to PDF" is the v1 PDF
  const kindBadge: Record<string, string> = {
    chat: '', event: 'EVENT', decision: 'DECISION', system: 'SYSTEM',
  }
  archive.append(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Incident ${incidentId} — ${esc(incident.title)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; color: #17191c; }
  h1 { margin-bottom: .25rem; } .meta { color: #5b6370; margin-bottom: 2rem; }
  .msg { padding: .5rem .75rem; border-bottom: 1px solid #e6e4df; }
  .msg .head { font-size: .8rem; color: #5b6370; }
  .msg .head b { color: #17191c; }
  .badge { font-weight: 700; font-size: .7rem; padding: 0 .4rem; border-radius: .25rem; }
  .badge.event { background: #eaf1f8; color: #224669; }
  .badge.decision { background: #fbe9ec; color: #9b0a22; }
  .badge.system { background: #efede9; color: #5b6370; }
  .body { white-space: pre-wrap; margin-top: .15rem; }
  @media print { .msg { break-inside: avoid; } }
</style></head><body>
<h1>${esc(incident.title)}</h1>
<p class="meta">Incident #${incidentId} · ${esc(incident.incident_type)} · severity ${esc(incident.severity)} · status ${esc(incident.status)}<br>
Opened ${iso(incident.created_at)}${incident.closed_at ? ` · Closed ${iso(incident.closed_at)}` : ''}<br>
Exported ${new Date().toISOString()} by ${esc(req.user!.display_name)} (${esc(req.user!.email)})</p>
${messages.map((m) => `<div class="msg">
  <div class="head">${kindBadge[m.kind] ? `<span class="badge ${m.kind}">${kindBadge[m.kind]}</span> ` : ''}<b>${esc(m.display_name)}</b> · ${iso(m.created_at)}</div>
  <div class="body">${esc(m.body)}</div>
</div>`).join('\n')}
</body></html>`, { name: 'messages.html' })

  archive.append(csv([
    ['message_id', 'created_at_utc', 'kind', 'author', 'body'],
    ...messages.map((m) => [m.message_id, iso(m.created_at), m.kind, m.display_name, m.body]),
  ]), { name: 'messages.csv' })

  archive.append(csv([
    ['audit_id', 'created_at_utc', 'actor', 'action', 'detail'],
    ...audit.map((a: { audit_id: unknown; created_at: Date; display_name: string | null; action: string; detail: string | null }) =>
      [Number(a.audit_id), iso(a.created_at), a.display_name ?? '', a.action, a.detail ?? '']),
  ]), { name: 'audit.csv' })

  archive.append(csv([
    ['file_id', 'path_in_zip', 'original_name', 'size_bytes', 'sha256', 'uploaded_by', 'uploaded_at_utc', 'deleted_at_utc'],
    ...files.map((f: { file_id: number; folder_id: number | null; original_name: string; size_bytes: unknown; sha256: Buffer; uploader_name: string; uploaded_at: Date; deleted_at: Date | null }) => {
      const dir = f.deleted_at ? 'files/_removed' : ['files', folderPath(f.folder_id)].filter(Boolean).join('/')
      return [f.file_id, `${dir}/${f.file_id}_${f.original_name}`, f.original_name, Number(f.size_bytes),
        f.sha256.toString('hex'), f.uploader_name, iso(f.uploaded_at), iso(f.deleted_at)]
    }),
  ]), { name: 'files.csv' })

  const fileAad = aad(incidentId, 'incident_files')
  for (const f of files) {
    const blob = await readBlob(incidentId, f.storage_name)
    const plain = decrypt(dataKey, { iv: f.iv, authTag: f.auth_tag, ciphertext: blob }, fileAad)
    const dir = f.deleted_at ? 'files/_removed' : ['files', folderPath(f.folder_id)].filter(Boolean).join('/')
    // file_id prefix keeps duplicate names from colliding inside the ZIP
    archive.append(plain, { name: `${dir}/${f.file_id}_${f.original_name.replace(/[\\/:*?"<>|]/g, '_')}` })
  }

  await archive.finalize()
}
