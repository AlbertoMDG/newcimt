// Monday spike: can we reach NDCSQLB1, and can webadmin create the CIMT database?
import { dbConfig, sql } from '../server/src/db.ts'

async function main() {
  const cfg = dbConfig('master')
  console.log(`Connecting to ${cfg.server} as ${cfg.user} (database: master)...`)
  const pool = await new sql.ConnectionPool(cfg).connect()
  console.log('Connected.')

  const version = await pool.request().query('SELECT @@VERSION AS v, SYSTEM_USER AS u')
  console.log(`Server: ${version.recordset[0].v.split('\n')[0]}`)
  console.log(`Login:  ${version.recordset[0].u}`)

  const dbs = await pool.request().query(`SELECT name FROM sys.databases WHERE name = 'CIMT'`)
  if (dbs.recordset.length > 0) {
    console.log(`Database CIMT already exists.`)
  } else {
    const perm = await pool
      .request()
      .query(`SELECT HAS_PERMS_BY_NAME(NULL, NULL, 'CREATE ANY DATABASE') AS canCreate`)
    console.log(`CREATE DATABASE permission: ${perm.recordset[0].canCreate === 1 ? 'YES' : 'NO'}`)
  }

  await pool.close()
}

main().catch((err) => {
  console.error('DB CHECK FAILED:', err.message)
  process.exit(1)
})
