import sql from 'mssql'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
dotenv.config({ path: path.join(rootDir, '.env') })

export function dbConfig(database?: string): sql.config {
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env
  if (!DB_HOST || !DB_USER || !DB_PASSWORD) {
    throw new Error('Missing DB_HOST / DB_USER / DB_PASSWORD in .env')
  }
  return {
    server: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: database ?? DB_NAME ?? 'CIMT',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  }
}

let pool: sql.ConnectionPool | null = null

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool
  pool = await new sql.ConnectionPool(dbConfig()).connect()
  return pool
}

export { sql }
