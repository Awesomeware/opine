import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.ts'

let connection: { pool: Pool; db: ReturnType<typeof createDatabase> } | undefined

function createDatabase(pool: Pool) {
  return drizzle({ client: pool, schema })
}

export function getDatabase() {
  if (connection) return connection.db

  const connectionString = process.env.DATABASE_URL
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL is required to connect to PostgreSQL.')
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
  })
  // Idle clients can fail when PostgreSQL restarts. Never log connection details.
  pool.on('error', () => console.error('An idle PostgreSQL connection failed.'))

  connection = { pool, db: createDatabase(pool) }
  return connection.db
}

export async function closeDatabase() {
  const current = connection
  connection = undefined
  await current?.pool.end()
}
