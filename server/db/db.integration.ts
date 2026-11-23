import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { afterEach, test } from 'node:test'
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { closeDatabase, getDatabase } from './index.ts'
import { applyMigrations, withMigrationDatabase } from '../../tests/helpers/migration-database.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run integration tests with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)
const databaseName = new URL(databaseUrl).pathname.slice(1)

afterEach(closeDatabase)

test('removing write receipts preserves existing feedback and its cooldown timestamp', async () => {
  await withMigrationDatabase(async (database) => {
    await applyMigrations(database, 0, 6)
    await database.query(
      "insert into auth_user (id, name, email) values ('receipt-upgrade', 'Author', 'upgrade@example.test')",
    )
    const {
      rows: [post],
    } = await database.query(
      "insert into feedback_post (author_id, category_id, title, description) select 'receipt-upgrade', id, 'Existing post', 'Keep this content' from feedback_category limit 1 returning *",
    )
    await database.query(
      "insert into feedback_comment (post_id, author_id, body, type) values ($1, 'receipt-upgrade', 'Keep this comment', 'question')",
      [post.id],
    )
    await database.query(
      "insert into feedback_follow (post_id, user_id) values ($1, 'receipt-upgrade')",
      [post.id],
    )
    await database.query(
      "insert into feedback_write_receipt (actor_id, request_id, operation, request_hash, result) values ('receipt-upgrade', gen_random_uuid(), 'create-post', 'obsolete', $1)",
      [{ id: post.id }],
    )
    const comments = (await database.query('select * from feedback_comment')).rows
    const follows = (await database.query('select * from feedback_follow')).rows

    await applyMigrations(database, 6, 7)

    assert.equal(
      (await database.query("select to_regclass('public.feedback_write_receipt') as receipt_table"))
        .rows[0].receipt_table,
      null,
    )
    assert.deepEqual((await database.query('select * from feedback_post')).rows, [post])
    assert.deepEqual((await database.query('select * from feedback_comment')).rows, comments)
    assert.deepEqual((await database.query('select * from feedback_follow')).rows, follows)
  })
})

test('queries PostgreSQL and reconnects after closing the pool', async () => {
  const first = getDatabase()
  assert.equal(getDatabase(), first)
  const result = await first.execute(sql`select current_database() as name, 1 as value`)
  assert.equal(result.rows[0]?.value, 1)
  assert.equal(result.rows[0]?.name, databaseName)
  await closeDatabase()
  const second = getDatabase()
  assert.notEqual(first, second)
  assert.equal((await second.execute(sql`select 2 as value`)).rows[0]?.value, 2)
})

test('moderation migration preserves existing content and starts with an empty event log', async () => {
  await withMigrationDatabase(async (database) => {
    await applyMigrations(database, 0, 7)
    await database.query(
      "insert into auth_user (id, name, email) values ('moderation-upgrade', 'Author', 'moderation@example.test')",
    )
    const {
      rows: [post],
    } = await database.query(
      "insert into feedback_post (author_id, category_id, title, description) select 'moderation-upgrade', id, 'Existing post', 'Keep this content' from feedback_category limit 1 returning *",
    )

    await applyMigrations(database, 7, 8)

    assert.deepEqual((await database.query('select * from feedback_post')).rows, [
      { ...post, locked_at: null, archived_at: null },
    ])
    assert.deepEqual((await database.query('select * from event_log')).rows, [])
  })
})

test('committed migrations can be reapplied without changing history or stored data', async () => {
  const config = { migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)) }
  const database = getDatabase()
  const history = await database.execute(
    sql`select * from drizzle.__drizzle_migrations order by id`,
  )
  assert.equal(history.rows.length, readMigrationFiles(config).length)

  await database.execute(sql`create table opine_test_persistence (value text not null)`)
  try {
    await database.execute(sql`insert into opine_test_persistence (value) values ('persisted')`)
    await migrate(database, config)
    await closeDatabase()

    const reconnected = getDatabase()
    assert.deepEqual(
      (await reconnected.execute(sql`select * from drizzle.__drizzle_migrations order by id`)).rows,
      history.rows,
    )
    assert.deepEqual(
      (await reconnected.execute(sql`select value from opine_test_persistence`)).rows,
      [{ value: 'persisted' }],
    )
  } finally {
    await getDatabase().execute(sql`drop table opine_test_persistence`)
  }
})

test('removing categories preserves posts, assigned tags and business events', async () => {
  await withMigrationDatabase(async (database) => {
    await applyMigrations(database, 0, 9)
    await database.query(
      "insert into auth_user (id, name, email) values ('category-upgrade', 'Author', 'category@example.test')",
    )
    const {
      rows: [post],
    } = await database.query(
      "insert into feedback_post (author_id, category_id, title, description) select 'category-upgrade', id, 'Tagged post', 'Keep this content' from feedback_category limit 1 returning *",
    )
    await database.query(
      "insert into feedback_post_tag select $1, id from feedback_tag where name in ('Gameplay', 'UI')",
      [post.id],
    )
    await database.query(
      "insert into event_log (event_type, actor_id, details) values ('post.created', 'category-upgrade', $1)",
      [{ postId: post.id }],
    )
    const tags = (await database.query('select * from feedback_post_tag order by tag_id')).rows
    const events = (await database.query('select * from event_log')).rows
    await applyMigrations(database, 9)
    const { category_id: _categoryId, ...expected } = post
    assert.deepEqual((await database.query('select * from feedback_post')).rows, [expected])
    assert.deepEqual(
      (await database.query('select * from feedback_post_tag order by tag_id')).rows,
      tags,
    )
    assert.deepEqual((await database.query('select * from event_log')).rows, events)
    assert.deepEqual(
      (
        await database.query(
          "select to_regclass('feedback_category') as category, to_regclass('feedback_category_change') as history",
        )
      ).rows,
      [{ category: null, history: null }],
    )
  })
})
