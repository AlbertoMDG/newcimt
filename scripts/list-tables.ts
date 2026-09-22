import { getPool } from '../server/src/db.ts'

const pool = await getPool()
const r = await pool
  .request()
  .query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME`)
console.log(r.recordset.length === 0 ? 'CIMT database is empty (no tables).' : r.recordset)
await pool.close()
