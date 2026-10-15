// Master-key rotation: re-wraps EVERY incident's data key under the new master key.
//
// Procedure:
//   1. Move the old key to CIMT_MASTER_KEY_PREVIOUS in .env
//   2. Put the new key in CIMT_MASTER_KEY
//   3. Run: npm run rotate:master-key
//   4. Once it reports 0 failures, remove CIMT_MASTER_KEY_PREVIOUS and back up the new key
//
// Message/file ciphertext is untouched — only each data key's envelope changes.
import { getPool, sql } from '../server/src/db.ts'
import { rewrapKey } from '../server/src/crypto.ts'

const pool = await getPool()
const rows = (await pool.request()
  .query('SELECT incident_id, data_key FROM dbo.incidents')).recordset

let ok = 0
let failed = 0
for (const row of rows) {
  try {
    const rewrapped = rewrapKey(row.data_key)
    await pool.request()
      .input('id', sql.Int, row.incident_id)
      .input('dk', sql.VarBinary(256), rewrapped)
      .query(`UPDATE dbo.incidents
              SET data_key = @dk, key_version = key_version + 1, updated_at = SYSUTCDATETIME(),
                  updated_by = 'rotate-master-key'
              WHERE incident_id = @id`)
    ok++
  } catch (err) {
    failed++
    console.error(`incident ${row.incident_id}: FAILED — ${err instanceof Error ? err.message : err}`)
  }
}

console.log(`Rotated ${ok}/${rows.length} incident keys${failed ? ` — ${failed} FAILED (old key missing from CIMT_MASTER_KEY_PREVIOUS?)` : ''}`)
await pool.close()
process.exit(failed ? 1 : 0)
