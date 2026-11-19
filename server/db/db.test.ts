import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { closeDatabase, getDatabase } from './index.ts'

const databaseUrl = process.env.DATABASE_URL

afterEach(async () => {
  await closeDatabase()
  if (databaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = databaseUrl
})

test('database access requires a URL without leaking credentials', () => {
  delete process.env.DATABASE_URL
  assert.throws(getDatabase, { message: 'DATABASE_URL is required to connect to PostgreSQL.' })
  process.env.DATABASE_URL = '   '
  assert.throws(getDatabase, { message: 'DATABASE_URL is required to connect to PostgreSQL.' })
})

test('reuses the database client until shutdown and can close an unused pool', async () => {
  process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused'
  const first = getDatabase()
  assert.equal(getDatabase(), first)
  await closeDatabase()
  await closeDatabase()
  assert.notEqual(getDatabase(), first)
})
