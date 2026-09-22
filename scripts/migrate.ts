// Runs 002-schema.sql against the CIMT database, batch by batch (split on GO lines).
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../server/src/db.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const sqlText = await readFile(path.join(here, '002-schema.sql'), 'utf8')
const batches = sqlText
  .split(/^\s*GO\s*$/im)
  .map((b) => b.trim())
  .filter(Boolean)

const pool = await getPool()
for (const [i, batch] of batches.entries()) {
  try {
    await pool.request().batch(batch)
  } catch (err) {
    console.error(`Batch ${i + 1} failed:\n${batch.slice(0, 200)}...`)
    throw err
  }
}
console.log(`Migration complete: ${batches.length} batches executed.`)
await pool.close()
