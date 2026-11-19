import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { Client } from 'pg'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../tests/fixtures.ts'
import { feedbackCategory, feedbackComment, feedbackPost, feedbackWriteReceipt } from './schema.ts'
import {
  createComment,
  editComment,
  getComment,
  listComments,
  replayLegacyComment,
} from './participation.ts'
import { FeedbackWriteError } from './writes.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackComment)
  await database.delete(feedbackWriteReceipt)
  await database.delete(feedbackPost)
  await database.delete(feedbackCategory)
  await database.delete(user)
})

async function discussion() {
  const member = await createMember()
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  return { member, post }
}

function conflict(error: unknown) {
  return error instanceof FeedbackWriteError && error.statusCode === 409
}

test('typed filtering precedes pagination, keeps timestamp ties, and leaves legacy comments accessible', async () => {
  const { member, post } = await discussion()
  const types = [
    null,
    'suggestion',
    'question',
    'suggestion',
    'context',
    'suggestion',
    'different_view',
  ] as const
  const comments = await getDatabase()
    .insert(feedbackComment)
    .values(
      types.map((type, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        postId: post.id,
        authorId: member.user.id,
        body: `Contribution ${index + 1}`,
        type,
        createdAt: new Date('2026-01-01T12:00:00.123Z'),
      })),
    )
    .returning()
  const first = await listComments(post.id, { type: 'suggestion', limit: 2 })
  assert.deepEqual(
    first.comments.map((comment) => comment.id),
    [comments[1]!.id, comments[3]!.id],
  )
  assert.ok(first.nextCursor)
  const second = await listComments(post.id, {
    type: 'suggestion',
    limit: 2,
    cursor: JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString()),
  })
  assert.deepEqual(
    second.comments.map((comment) => comment.id),
    [comments[5]!.id],
  )
  assert.equal(second.nextCursor, null)
  for (const type of ['context', 'different_view', 'question'] as const) {
    const page = await listComments(post.id, { type })
    assert.equal(page.comments.length, 1)
    assert.equal(page.comments[0]!.type, type)
  }
  const all = await listComments(post.id)
  assert.equal(all.comments.length, types.length)
  assert.equal(all.comments[0]!.type, null)
  assert.equal((await getComment(post.id, comments[0]!.id))?.type, null)
  assert.equal((await getComment(post.id, comments[6]!.id))?.type, 'different_view')
})

test('type-only edits mark content edited while omission preserves typed and legacy contributions', async () => {
  const { member, post } = await discussion()
  const created = await createComment(
    member.user.id,
    post.id,
    { body: 'A useful alternative', type: 'context' },
    randomUUID(),
  )
  const changed = { body: 'A useful alternative', type: 'suggestion' as const, version: 1 }
  const requestId = randomUUID()
  const result = await editComment(member.user.id, post.id, created.id, changed, requestId)
  assert.equal(result.version, 2)
  const edited = await getComment(post.id, created.id)
  assert.equal(edited?.type, 'suggestion')
  assert.ok(edited?.editedAt)
  assert.deepEqual(
    await editComment(member.user.id, post.id, created.id, changed, requestId),
    result,
  )
  await assert.rejects(
    editComment(member.user.id, post.id, created.id, { ...changed, type: 'question' }, requestId),
    conflict,
  )
  await assert.rejects(
    editComment(
      member.user.id,
      post.id,
      created.id,
      { ...changed, type: 'question' },
      randomUUID(),
    ),
    conflict,
  )
  await editComment(member.user.id, post.id, created.id, { ...changed, version: 2 }, randomUUID())
  assert.deepEqual(await getComment(post.id, created.id), edited)
  await editComment(
    member.user.id,
    post.id,
    created.id,
    { body: 'More detail', version: 2 },
    randomUUID(),
  )
  assert.equal((await getComment(post.id, created.id))?.type, 'suggestion')

  const [legacy] = await getDatabase()
    .insert(feedbackComment)
    .values({ postId: post.id, authorId: member.user.id, body: 'Before types' })
    .returning()
  assert.ok(legacy)
  await editComment(
    member.user.id,
    post.id,
    legacy.id,
    { body: 'Before types', version: 1 },
    randomUUID(),
  )
  assert.equal((await getComment(post.id, legacy.id))?.editedAt, null)
  await editComment(
    member.user.id,
    post.id,
    legacy.id,
    { body: 'Updated legacy text', version: 1 },
    randomUUID(),
  )
  assert.equal((await getComment(post.id, legacy.id))?.type, null)
  await editComment(
    member.user.id,
    post.id,
    legacy.id,
    { body: 'Updated legacy text', version: 2, type: 'question' },
    randomUUID(),
  )
  assert.equal((await getComment(post.id, legacy.id))?.type, 'question')
  assert.equal((await getComment(post.id, legacy.id))?.version, 3)
})

test('typed creates deduplicate and cannot reuse a request key with another contribution type', async () => {
  const { member, post } = await discussion()
  const input = { body: 'Consider an alternative', type: 'suggestion' as const }
  const requestId = randomUUID()
  const replies = await Promise.all(
    Array.from({ length: 3 }, () => createComment(member.user.id, post.id, input, requestId)),
  )
  assert.deepEqual(replies[1], replies[0])
  assert.deepEqual(replies[2], replies[0])
  assert.equal((await getDatabase().select().from(feedbackComment)).length, 1)
  await assert.rejects(
    createComment(member.user.id, post.id, { ...input, type: 'different_view' }, requestId),
    conflict,
  )
  assert.equal((await getComment(post.id, replies[0]!.id))?.type, 'suggestion')
})

test('the contribution migration preserves existing comments and successful untyped write receipts', async () => {
  // Reuse the suite's container, but keep the pre-upgrade schema in its own database.
  const name = `opine_upgrade_${randomUUID().replaceAll('-', '')}`
  const control = new Client({ connectionString: databaseUrl })
  await control.connect()
  const isolatedUrl = new URL(databaseUrl)
  isolatedUrl.pathname = `/${name}`
  const isolated = new Client({ connectionString: isolatedUrl.toString() })
  let connected = false
  let created = false
  try {
    await control.query(`create database "${name}"`)
    created = true
    await isolated.connect()
    connected = true
    const migrations = readMigrationFiles({
      migrationsFolder: fileURLToPath(new URL('../../../drizzle', import.meta.url)),
    })
    assert.ok(migrations.length >= 4)
    for (const migration of migrations.slice(0, 3))
      for (const statement of migration.sql) await isolated.query(statement)
    const actorId = randomUUID()
    const postId = randomUUID()
    const commentId = randomUUID()
    const requestId = randomUUID()
    const body = 'Original unclassified contribution'
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ operation: 'create-comment', input: { postId, body } }))
      .digest('hex')
    await isolated.query('insert into auth_user (id, name, email) values ($1, $2, $3)', [
      actorId,
      'Legacy author',
      'legacy@example.test',
    ])
    await isolated.query(
      "insert into feedback_post (id, author_id, category_id, title, description) select $1, $2, id, 'Legacy post', 'Existing proposal' from feedback_category limit 1",
      [postId, actorId],
    )
    await isolated.query(
      'insert into feedback_comment (id, post_id, author_id, body, version, edited_at) values ($1, $2, $3, $4, 2, $5)',
      [commentId, postId, actorId, body, new Date('2026-01-01T12:00:00.123Z')],
    )
    await isolated.query(
      'insert into feedback_write_receipt (actor_id, request_id, operation, request_hash, result) values ($1, $2, $3, $4, $5)',
      [actorId, requestId, 'create-comment', requestHash, { id: commentId, version: 1 }],
    )
    const beforeComment = (await isolated.query('select * from feedback_comment')).rows[0]
    const beforeReceipt = (await isolated.query('select * from feedback_write_receipt')).rows[0]
    for (const statement of migrations[3]!.sql) await isolated.query(statement)
    assert.deepEqual((await isolated.query('select * from feedback_comment')).rows[0], {
      ...beforeComment,
      type: null,
    })
    assert.deepEqual(
      (await isolated.query('select * from feedback_write_receipt')).rows[0],
      beforeReceipt,
    )
  } finally {
    if (connected) await isolated.end()
    if (created) await control.query(`drop database "${name}"`)
    await control.end()
  }
})

test('pre-upgrade body-only retries replay receipts without allowing new untyped contributions', async () => {
  const { member, post } = await discussion()
  const input = { body: 'Already submitted before the upgrade' }
  const [legacy] = await getDatabase()
    .insert(feedbackComment)
    .values({ postId: post.id, authorId: member.user.id, ...input })
    .returning()
  assert.ok(legacy)
  const requestId = randomUUID()
  const result = { id: legacy.id, version: 1 }
  const requestHash = createHash('sha256')
    .update(JSON.stringify({ operation: 'create-comment', input: { postId: post.id, ...input } }))
    .digest('hex')
  await getDatabase().insert(feedbackWriteReceipt).values({
    actorId: member.user.id,
    requestId,
    operation: 'create-comment',
    requestHash,
    result,
  })
  assert.deepEqual(await replayLegacyComment(member.user.id, post.id, input, requestId), result)
  await assert.rejects(
    replayLegacyComment(member.user.id, post.id, { body: 'Changed old request' }, requestId),
    conflict,
  )
  await assert.rejects(
    createComment(member.user.id, post.id, { ...input, type: 'context' }, requestId),
    conflict,
  )
  assert.equal(await replayLegacyComment(member.user.id, post.id, input, randomUUID()), null)
  const other = await createMember()
  assert.equal(await replayLegacyComment(other.user.id, post.id, input, requestId), null)
  assert.equal((await getDatabase().select().from(feedbackComment)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackWriteReceipt)).length, 1)
  assert.equal((await getComment(post.id, legacy.id))?.type, null)
})
