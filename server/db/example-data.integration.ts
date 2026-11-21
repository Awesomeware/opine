import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { eq, getTableName, is, sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { Client } from 'pg'
import { createMember } from '../../layers/auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../layers/feedback/tests/fixtures.ts'
import { defaultFeedbackTags } from '../../layers/feedback/server/posts/tags.ts'
import { examplePostIds, seedExampleData } from '../../layers/feedback/server/example-data.ts'
import { getOutcome } from '../../layers/feedback/server/review/outcome.ts'
import { listDiscussion } from '../../layers/feedback/server/discussion/feed.ts'
import { contributionTypes } from '../../layers/feedback/shared/discussion/contribution-types.ts'
import { closeDatabase, getDatabase } from './index.ts'
import { resetDatabase } from './maintenance.ts'
import * as schema from './schema.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run integration tests with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1))
const root = fileURLToPath(new URL('../../', import.meta.url))
const tables = Object.values(schema).filter((value) => is(value, PgTable))
after(closeDatabase)
afterEach(() => resetDatabase(databaseName))

async function cli(args: string[], url = databaseUrl) {
  const child = spawn(process.execPath, ['scripts/database.ts', ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    output += chunk.toString()
  })
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', resolve)
  })
  assert.ok(!output.includes(url!), 'CLI must not expose database credentials.')
  return { code, output }
}

async function contents() {
  const database = getDatabase()
  return Promise.all(
    tables.map(async (table) => ({
      table: getTableName(table),
      rows: (
        await database.execute(
          sql`select to_jsonb(row) as value from ${table} row order by to_jsonb(row)::text`,
        )
      ).rows,
    })),
  )
}

async function history() {
  return (await getDatabase().execute(sql`select * from drizzle.__drizzle_migrations order by id`))
    .rows
}

test('concurrent example seeding is additive, repeatable, and presents real discussion outcomes', async () => {
  const database = getDatabase()
  const member = await createMember({ roles: ['administrator'] })
  const category = await createCategory({ name: 'Keep this custom category' })
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  const existing = await contents()
  const results = await Promise.all(Array.from({ length: 3 }, () => seedExampleData()))
  assert.equal(
    results.reduce((total, result) => total + result.createdPosts, 0),
    3,
  )
  assert.equal((await database.select().from(schema.feedbackPost)).length, 4)
  assert.equal((await database.select().from(schema.feedbackPostTag)).length, 5)
  const comments = await database.select().from(schema.feedbackComment)
  assert.deepEqual(new Set(comments.map((comment) => comment.type)), new Set(contributionTypes))
  const responses = await database.select().from(schema.feedbackOfficialResponse)
  assert.equal(responses.length, 3)
  assert.ok((await database.select().from(schema.feedbackFollow)).length >= 3)
  assert.ok((await database.select().from(schema.feedbackNotification)).length > 0)
  for (const id of examplePostIds) {
    const outcome = await getOutcome(id)
    assert.ok(outcome)
    const discussion = await listDiscussion(id)
    assert.ok(discussion.entries.some((entry) => entry.kind === 'comment'))
    const official = responses.filter((response) => response.postId === id)
    assert.equal(
      discussion.entries.filter((entry) => entry.kind === 'response').length,
      official.length,
    )
    if (official.length) {
      assert.ok(outcome.latestResponse)
      assert.ok(outcome.statusResponse)
      assert.equal(outcome.status, outcome.statusResponse.status)
      const chronological = official.toSorted(
        (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
      )
      assert.equal(outcome.latestResponse.id, chronological.at(-1)!.id)
      assert.equal(
        outcome.statusResponse.id,
        chronological.findLast((response) => response.status)!.id,
      )
    }
  }
  const sampleUsers = (await database.select().from(schema.user)).filter(
    (row) => row.id !== member.user.id,
  )
  assert.ok(sampleUsers.length > 0)
  assert.ok(sampleUsers.every((row) => row.email.endsWith('.invalid')))
  for (const table of [schema.account, schema.session]) {
    const credentials = await database.select().from(table)
    assert.equal(credentials.length, 1)
    assert.equal(credentials[0]!.userId, member.user.id)
  }
  const afterSeed = await contents()
  for (const original of existing) {
    const current = afterSeed.find((entry) => entry.table === original.table)!
    for (const row of original.rows)
      assert.ok(current.rows.some((value) => JSON.stringify(value) === JSON.stringify(row)))
  }
  await database
    .update(schema.feedbackPost)
    .set({ title: 'Keep my example edit', version: 2 })
    .where(eq(schema.feedbackPost.id, examplePostIds[0]!))
  await database
    .update(schema.feedbackComment)
    .set({ body: 'Keep my comment edit', version: 2 })
    .where(eq(schema.feedbackComment.id, comments[0]!.id))
  const edited = await contents()
  assert.deepEqual(await seedExampleData(), { createdPosts: 0 })
  assert.deepEqual(await contents(), edited)
  assert.deepEqual(
    (
      await database.select().from(schema.feedbackPost).where(eq(schema.feedbackPost.id, post.id))
    )[0],
    post,
  )
})

test('example tags respect disabled choices and preserve authors’ removed assignments', async () => {
  const database = getDatabase()
  const ui = defaultFeedbackTags.find((tag) => tag.name === 'UI')!
  await database
    .update(schema.feedbackTag)
    .set({ isActive: false })
    .where(eq(schema.feedbackTag.id, ui.id))
  await seedExampleData()
  assert.equal(
    (
      await database
        .select()
        .from(schema.feedbackPostTag)
        .where(eq(schema.feedbackPostTag.tagId, ui.id))
    ).length,
    0,
  )
  assert.equal((await database.select().from(schema.feedbackPostTag)).length, 3)
  await database
    .delete(schema.feedbackPostTag)
    .where(eq(schema.feedbackPostTag.postId, examplePostIds[2]))
  await database
    .update(schema.feedbackTag)
    .set({ isActive: true, name: 'Interface' })
    .where(eq(schema.feedbackTag.id, ui.id))
  const before = await contents()
  assert.deepEqual(await seedExampleData(), { createdPosts: 0 })
  assert.deepEqual(await contents(), before)
})

test('reset requires the exact database name, clears all app data, and preserves migrations and unrelated tables', async () => {
  const database = getDatabase()
  await seedExampleData()
  const member = await createMember({ roles: ['administrator', 'community-manager'] })
  await database.insert(schema.verification).values({
    id: randomUUID(),
    identifier: 'test',
    value: 'secret',
    expiresAt: new Date(Date.now() + 60_000),
  })
  await database
    .insert(schema.rateLimit)
    .values({ id: randomUUID(), key: 'test', count: 4, lastRequest: Date.now() })
  const original = await contents()
  const migrations = await history()
  for (const args of [
    ['reset'],
    ['reset', '--confirm', `${databaseName}_wrong`],
    ['reset', '--confirm', databaseName, 'unexpected'],
  ]) {
    const result = await cli(args)
    assert.equal(result.code, 1, result.output)
    assert.deepEqual(await contents(), original)
    assert.deepEqual(await history(), migrations)
  }
  await assert.rejects(resetDatabase(`${databaseName}_wrong`))
  assert.deepEqual(await contents(), original)
  await database.execute(
    sql`create table opine_external_reference (user_id text references auth_user(id))`,
  )
  try {
    await database.execute(sql`insert into opine_external_reference values (${member.user.id})`)
    const refused = await cli(['reset', '--confirm', databaseName])
    assert.equal(refused.code, 1, refused.output)
    assert.deepEqual(await contents(), original)
    assert.deepEqual(await history(), migrations)
    assert.deepEqual((await database.execute(sql`select * from opine_external_reference`)).rows, [
      { user_id: member.user.id },
    ])
  } finally {
    await database.execute(sql`drop table opine_external_reference`)
  }
  await database.execute(sql`create table opine_unrelated_data (value text not null)`)
  try {
    await database.execute(sql`insert into opine_unrelated_data values ('keep me')`)
    const result = await cli(['reset', '--confirm', databaseName])
    assert.equal(result.code, 0, result.output)
    for (const table of tables) {
      if (table === schema.feedbackCategory || table === schema.feedbackTag) continue
      assert.equal((await database.select().from(table)).length, 0, getTableName(table))
    }
    const tags = await database.select().from(schema.feedbackTag).orderBy(schema.feedbackTag.id)
    assert.deepEqual(
      tags.map(({ id, name }) => ({ id, name })),
      defaultFeedbackTags.map(({ id, name }) => ({ id, name })),
    )
    assert.ok(tags.every((tag) => tag.isActive && tag.version === 1))
    const categories = await database.select().from(schema.feedbackCategory)
    assert.equal(categories.length, 1)
    assert.equal(categories[0]!.name, 'General feedback')
    assert.equal(categories[0]!.isActive, true)
    assert.deepEqual(await history(), migrations)
    assert.deepEqual((await database.execute(sql`select * from opine_unrelated_data`)).rows, [
      { value: 'keep me' },
    ])
    const seeded = await cli(['seed'])
    assert.equal(seeded.code, 0, seeded.output)
    assert.equal((await database.select().from(schema.feedbackPost)).length, 3)
    assert.deepEqual(await history(), migrations)
  } finally {
    await database.execute(sql`drop table opine_unrelated_data`)
  }
})

test('CLI seed migrates a fresh database while invalid or unconfirmed commands leave it untouched', async () => {
  const name = `opine_seed_${randomUUID().replaceAll('-', '')}`
  const control = new Client({ connectionString: databaseUrl })
  await control.connect()
  const freshUrl = new URL(databaseUrl)
  freshUrl.pathname = `/${name}`
  const fresh = new Client({ connectionString: freshUrl.toString() })
  let created = false
  let connected = false
  try {
    await control.query(`create database "${name}"`)
    created = true
    await fresh.connect()
    connected = true
    for (const args of [
      [],
      ['unknown'],
      ['seed', 'unexpected'],
      ['reset'],
      ['reset', '--confirm', 'wrong'],
    ]) {
      const result = await cli(args, freshUrl.toString())
      assert.equal(result.code, 1, result.output)
      assert.equal(
        (
          await fresh.query(
            "select count(*)::int as count from information_schema.tables where table_schema in ('public', 'drizzle')",
          )
        ).rows[0].count,
        0,
      )
    }
    const seeded = await cli(['seed'], freshUrl.toString())
    assert.equal(seeded.code, 0, seeded.output)
    assert.equal(
      (await fresh.query('select count(*)::int as count from feedback_post')).rows[0].count,
      3,
    )
    assert.ok(
      (await fresh.query('select count(*)::int as count from drizzle.__drizzle_migrations')).rows[0]
        .count > 0,
    )
  } finally {
    if (connected) await fresh.end()
    if (created) await control.query(`drop database "${name}"`)
    await control.end()
  }
})
