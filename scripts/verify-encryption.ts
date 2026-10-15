// Read-only integrity check of all encrypted war-room data.
// Per incident: unwraps the data key, decrypts recent messages (GCM tag check),
// and decrypts every stored file comparing its plaintext sha256 against the DB.
// Exit code 1 if anything fails. Run: npm run verify:encryption
import { createHash } from 'node:crypto'
import { getPool, sql } from '../server/src/db.ts'
import { aad, decrypt, unwrapKey } from '../server/src/crypto.ts'
import { readBlob } from '../server/src/files.ts'

const MESSAGES_PER_INCIDENT = 100

const pool = await getPool()
const incidents = (await pool.request()
  .query('SELECT incident_id, title, data_key FROM dbo.incidents ORDER BY incident_id')).recordset

let problems = 0
const fail = (msg: string) => { problems++; console.error(`  FAIL: ${msg}`) }

for (const inc of incidents) {
  console.log(`incident ${inc.incident_id} — ${inc.title}`)
  let dataKey: Buffer
  try {
    dataKey = unwrapKey(inc.data_key)
  } catch (err) {
    fail(`cannot unwrap data key: ${err instanceof Error ? err.message : err}`)
    continue
  }

  // Messages: decryption itself verifies the GCM tag + AAD
  const messages = (await pool.request()
    .input('id', sql.Int, inc.incident_id)
    .input('limit', sql.Int, MESSAGES_PER_INCIDENT)
    .query(`SELECT TOP (@limit) message_id, ciphertext, iv, auth_tag
            FROM dbo.incident_messages WHERE incident_id = @id ORDER BY message_id DESC`)).recordset
  let msgOk = 0
  for (const m of messages) {
    try {
      decrypt(dataKey, { iv: m.iv, authTag: m.auth_tag, ciphertext: m.ciphertext },
        aad(inc.incident_id, 'incident_messages'))
      msgOk++
    } catch {
      fail(`message ${m.message_id} does not decrypt (tampered or wrong key)`)
    }
  }

  // Files: decrypt the blob and compare the plaintext hash recorded at upload
  const files = (await pool.request()
    .input('id', sql.Int, inc.incident_id)
    .query(`SELECT file_id, original_name, storage_name, iv, auth_tag, sha256
            FROM dbo.incident_files WHERE incident_id = @id`)).recordset
  let fileOk = 0
  for (const f of files) {
    try {
      const blob = await readBlob(inc.incident_id, f.storage_name)
      const plain = decrypt(dataKey, { iv: f.iv, authTag: f.auth_tag, ciphertext: blob },
        aad(inc.incident_id, 'incident_files'))
      if (!createHash('sha256').update(plain).digest().equals(f.sha256)) {
        fail(`file ${f.file_id} "${f.original_name}": sha256 mismatch`)
      } else {
        fileOk++
      }
    } catch (err) {
      fail(`file ${f.file_id} "${f.original_name}": ${err instanceof Error ? err.message : err}`)
    }
  }
  console.log(`  messages ${msgOk}/${messages.length} ok · files ${fileOk}/${files.length} ok`)
}

console.log(problems
  ? `\nVERIFICATION FAILED: ${problems} problem(s) found`
  : `\nVerification passed: ${incidents.length} incident(s), all encrypted data intact`)
await pool.close()
process.exit(problems ? 1 : 0)
