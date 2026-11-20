import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Client } from 'pg'

/** Exercise upgrades inside the suite's container without changing its main schema. */
export async function withMigrationDatabase(run: (database: Client) => Promise<void>) {
  const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
  assert.ok(databaseUrl, 'Run with pnpm test:integration.')
  assert.equal(process.env.DATABASE_URL, databaseUrl)
  const name = `opine_upgrade_${randomUUID().replaceAll('-', '')}`
  const control = new Client({ connectionString: databaseUrl })
  const url = new URL(databaseUrl)
  url.pathname = `/${name}`
  const isolated = new Client({ connectionString: url.toString() })
  let created = false
  try {
    await control.connect()
    await control.query(`create database "${name}"`)
    created = true
    await isolated.connect()
    await run(isolated)
  } finally {
    try {
      await isolated.end()
      if (created) await control.query(`drop database "${name}"`)
    } finally {
      await control.end()
    }
  }
}

/** Apply a zero-based migration range, with an exclusive end. */
export async function applyMigrations(database: Client, start: number, end?: number) {
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  })
  assert.ok(start >= 0 && start < migrations.length)
  assert.ok(end === undefined || (end > start && end <= migrations.length))
  for (const migration of migrations.slice(start, end)) {
    for (const statement of migration.sql) await database.query(statement)
  }
}
