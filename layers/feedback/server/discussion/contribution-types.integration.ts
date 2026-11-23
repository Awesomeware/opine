import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { eventLog } from '../../../../server/events/schema.ts'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import {
  applyMigrations,
  withMigrationDatabase,
} from '../../../../tests/helpers/migration-database.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createFeedbackPost } from '../../tests/fixtures.ts'
import { feedbackComment, feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { createComment, editComment, getComment, listComments } from './comments.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackComment)
  await database.delete(feedbackPost)
  await database.delete(eventLog)
  await database.delete(user)
})

async function discussion() {
  const member = await createMember()
  const post = await createFeedbackPost({ authorId: member.user.id })
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
  const created = await createComment(member.user.id, post.id, {
    body: 'A useful alternative',
    type: 'context',
  })
  const changed = { body: 'A useful alternative', type: 'suggestion' as const, version: 1 }
  const result = await editComment(member.user.id, post.id, created.id, changed)
  assert.equal(result.version, 2)
  const edited = await getComment(post.id, created.id)
  assert.equal(edited?.type, 'suggestion')
  assert.ok(edited?.editedAt)
  await assert.rejects(editComment(member.user.id, post.id, created.id, changed), conflict)
  await assert.rejects(
    editComment(member.user.id, post.id, created.id, { ...changed, type: 'question' }),
    conflict,
  )
  await assert.rejects(
    editComment(member.user.id, post.id, created.id, { ...changed, type: 'question' }),
    conflict,
  )
  await editComment(member.user.id, post.id, created.id, { ...changed, version: 2 })
  assert.deepEqual(await getComment(post.id, created.id), edited)
  await editComment(member.user.id, post.id, created.id, { body: 'More detail', version: 2 })
  assert.equal((await getComment(post.id, created.id))?.type, 'suggestion')

  const [legacy] = await getDatabase()
    .insert(feedbackComment)
    .values({ postId: post.id, authorId: member.user.id, body: 'Before types' })
    .returning()
  assert.ok(legacy)
  await editComment(member.user.id, post.id, legacy.id, { body: 'Before types', version: 1 })
  assert.equal((await getComment(post.id, legacy.id))?.editedAt, null)
  await editComment(member.user.id, post.id, legacy.id, { body: 'Updated legacy text', version: 1 })
  assert.equal((await getComment(post.id, legacy.id))?.type, null)
  await editComment(member.user.id, post.id, legacy.id, {
    body: 'Updated legacy text',
    version: 2,
    type: 'question',
  })
  assert.equal((await getComment(post.id, legacy.id))?.type, 'question')
  assert.equal((await getComment(post.id, legacy.id))?.version, 3)
})

test('new contributions preserve each requested type', async () => {
  const { member, post } = await discussion()
  for (const type of ['context', 'suggestion', 'question', 'different_view'] as const) {
    const result = await createComment(member.user.id, post.id, {
      body: 'Consider an alternative',
      type,
    })
    assert.equal((await getComment(post.id, result.id))?.type, type)
  }
  assert.equal((await getDatabase().select().from(feedbackComment)).length, 4)
})

test('the contribution migration preserves existing comments and successful untyped write receipts', async () => {
  await withMigrationDatabase(async (isolated) => {
    await applyMigrations(isolated, 0, 3)
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
    await applyMigrations(isolated, 3, 4)
    assert.deepEqual((await isolated.query('select * from feedback_comment')).rows[0], {
      ...beforeComment,
      type: null,
    })
    assert.deepEqual(
      (await isolated.query('select * from feedback_write_receipt')).rows[0],
      beforeReceipt,
    )
  })
})
