// Append-only incident audit trail. Called from every incident endpoint so the
// legal record is complete from the first incident onward.
import { getPool, sql } from './db.ts'

export type AuditAction =
  | 'incident_created' | 'incident_updated' | 'status_changed'
  | 'member_added' | 'member_removed' | 'role_changed'
  | 'room_opened' | 'message_posted' | 'decision_logged'
  | 'folder_created' | 'file_uploaded' | 'file_downloaded' | 'file_deleted'
  | 'export_generated' | 'key_rotated'

export async function logAudit(
  incidentId: number,
  userId: number | null,
  action: AuditAction,
  detail?: Record<string, unknown>,
): Promise<void> {
  const pool = await getPool()
  await pool.request()
    .input('incident_id', sql.Int, incidentId)
    .input('user_id', sql.Int, userId)
    .input('action', sql.NVarChar(40), action)
    .input('detail', sql.NVarChar(sql.MAX), detail ? JSON.stringify(detail) : null)
    .query(`INSERT INTO dbo.incident_audit (incident_id, user_id, action, detail)
            VALUES (@incident_id, @user_id, @action, @detail)`)
}
