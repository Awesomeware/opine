import { eq, sql } from 'drizzle-orm'
import { NodePgPreparedQuery } from 'drizzle-orm/node-postgres/session'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { Client } from 'pg'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../tests/fixtures.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackPost,
  feedbackReaction,
  feedbackWriteReceipt,
} from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { createComment, editComment, getComment, listComments } from './comments.ts'
import { getReactions, setReaction } from './reactions.ts'

assert.ok(process.env.OPINE_TEST_DATABASE_URL, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackComment)
  await database.delete(feedbackReaction)
  await database.delete(feedbackWriteReceipt)
  await database.delete(feedbackPost)
  await database.delete(feedbackCategory)
  await database.delete(user)
})

function status(code: number) {
  return (error: unknown) => error instanceof FeedbackWriteError && error.statusCode === code
}
async function discussion() {
  const author = await createMember({ name: 'Post author' })
  const commenter = await createMember({ name: 'Comment author' })
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: author.user.id, categoryId: category.id })
  return { author, commenter, category, post }
}

test('comment ownership keeps contributions when an account is deleted and projections keep credentials private', async () => {
  const { author, commenter, post } = await discussion()
  const [comment] = await getDatabase()
    .insert(feedbackComment)
    .values({
      postId: post.id,
      authorId: commenter.user.id,
      body: 'Please include controller support.',
    })
    .returning()
  assert.ok(comment)
  await assert.rejects(
    getDatabase().delete(user).where(eq(user.id, commenter.user.id)),
    (error: unknown) =>
      error instanceof Error &&
      error.cause instanceof Error &&
      'code' in error.cause &&
      ['23503', '23001'].includes(String(error.cause.code)),
  )
  const output = await getComment(post.id, comment.id, commenter.user.id)
  assert.ok(output)
  assert.equal(output.canEdit, true)
  assert.deepEqual(output.author, { name: 'Comment author' })
  const serialized = JSON.stringify(output)
  for (const privateValue of [commenter.user.email, commenter.user.id, commenter.session.token])
    assert.ok(!serialized.includes(privateValue))
  assert.equal((await getComment(post.id, comment.id, author.user.id))?.canEdit, false)
  assert.equal(await getComment(randomUUID(), comment.id), undefined)
  assert.equal(await getComment(post.id, randomUUID()), undefined)
})

test('a failed comment write leaves no mutation or receipt and can be retried with the same key', async () => {
  const { commenter, post } = await discussion()
  const database = getDatabase()
  const requestId = randomUUID()
  await database.execute(
    sql`create function reject_test_comment() returns trigger language plpgsql as $$ begin raise exception 'Simulated comment failure'; end $$`,
  )
  try {
    await database.execute(
      sql`create trigger reject_test_comment before insert on feedback_comment for each row execute function reject_test_comment()`,
    )
    try {
      await assert.rejects(
        createComment(
          commenter.user.id,
          post.id,
          { body: 'Please clarify the map.', type: 'question' as const },
          requestId,
        ),
      )
      assert.equal((await database.select().from(feedbackComment)).length, 0)
      assert.equal((await database.select().from(feedbackWriteReceipt)).length, 0)
    } finally {
      await database.execute(sql`drop trigger reject_test_comment on feedback_comment`)
    }
  } finally {
    await database.execute(sql`drop function reject_test_comment()`)
  }
  const result = await createComment(
    commenter.user.id,
    post.id,
    { body: 'Please clarify the map.', type: 'question' as const },
    requestId,
  )
  assert.ok(await getComment(post.id, result.id))
  assert.equal((await database.select().from(feedbackWriteReceipt)).length, 1)
})

test('comments deduplicate concurrent retries, reject reused keys, and enforce a shared concurrent allowance', async () => {
  const { commenter, post } = await discussion()
  const requestId = randomUUID()
  const input = { body: 'Please clarify the map.', type: 'question' as const }
  const replies = await Promise.all(
    Array.from({ length: 4 }, () => createComment(commenter.user.id, post.id, input, requestId)),
  )
  for (const reply of replies) assert.deepEqual(reply, replies[0])
  assert.equal((await getDatabase().select().from(feedbackComment)).length, 1)
  await assert.rejects(
    createComment(
      commenter.user.id,
      post.id,
      { body: 'Different comment', type: 'question' },
      requestId,
    ),
    status(409),
  )
  const maximum = Number(process.env.FEEDBACK_COMMENT_MAX ?? 10)
  const outcomes = await Promise.allSettled(
    Array.from({ length: maximum + 1 }, () =>
      createComment(commenter.user.id, post.id, input, randomUUID()),
    ),
  )
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, maximum - 1)
  const failures = outcomes.filter((result) => result.status === 'rejected')
  assert.equal(failures.length, 2)
  for (const failure of failures) assert.ok(status(429)(failure.reason))
  assert.deepEqual(await createComment(commenter.user.id, post.id, input, requestId), replies[0])
  assert.equal((await getDatabase().select().from(feedbackComment)).length, maximum)
})

test('comment edits enforce ownership and versions without retaining original text', async () => {
  const { author, commenter, post } = await discussion()
  const created = await createComment(
    commenter.user.id,
    post.id,
    { body: 'Original comment', type: 'context' },
    randomUUID(),
  )
  const unchanged = { body: 'Original comment', version: 1 }
  await assert.rejects(
    editComment(author.user.id, post.id, created.id, unchanged, randomUUID()),
    status(403),
  )
  const unchangedKey = randomUUID()
  await editComment(commenter.user.id, post.id, created.id, unchanged, unchangedKey)
  assert.equal((await getComment(post.id, created.id))?.editedAt, null)
  const requestId = randomUUID()
  const input = { body: 'Updated comment', version: 1 }
  await assert.rejects(
    editComment(commenter.user.id, post.id, created.id, input, unchangedKey),
    status(409),
  )
  const saved = await editComment(commenter.user.id, post.id, created.id, input, requestId)
  assert.deepEqual(
    await editComment(commenter.user.id, post.id, created.id, unchanged, unchangedKey),
    { id: created.id, version: 1 },
  )
  assert.equal(saved.version, 2)
  assert.deepEqual(
    await editComment(commenter.user.id, post.id, created.id, input, requestId),
    saved,
  )
  await assert.rejects(
    editComment(
      commenter.user.id,
      post.id,
      created.id,
      { ...input, body: 'Changed payload' },
      requestId,
    ),
    status(409),
  )
  const outcomes = await Promise.allSettled(
    ['First edit', 'Second edit'].map((body) =>
      editComment(commenter.user.id, post.id, created.id, { body, version: 2 }, randomUUID()),
    ),
  )
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = outcomes.find((result) => result.status === 'rejected')
  assert.ok(rejected && status(409)(rejected.reason))
  const current = await getComment(post.id, created.id)
  assert.ok(current?.editedAt)
  assert.equal(current.version, 3)
  const stored = await getDatabase().select().from(feedbackComment)
  const receipts = await getDatabase().select().from(feedbackWriteReceipt)
  assert.ok(!JSON.stringify({ stored, receipts }).includes('Original comment'))
})

test('reactions have separate tallies, switch a single row, and old retries cannot resurrect removed reactions', async () => {
  const { author, commenter, post } = await discussion()
  const requestId = randomUUID()
  await Promise.all(
    Array.from({ length: 3 }, () => setReaction(author.user.id, post.id, 'agree', requestId)),
  )
  await setReaction(commenter.user.id, post.id, 'disagree', randomUUID())
  assert.deepEqual(await getReactions(post.id, author.user.id), {
    agree: 1,
    disagree: 1,
    mine: 'agree',
  })
  assert.deepEqual(await getReactions(post.id), { agree: 1, disagree: 1, mine: null })
  await setReaction(author.user.id, post.id, 'disagree', randomUUID())
  assert.deepEqual(await getReactions(post.id, author.user.id), {
    agree: 0,
    disagree: 2,
    mine: 'disagree',
  })
  assert.equal((await getDatabase().select().from(feedbackReaction)).length, 2)
  await assert.rejects(setReaction(author.user.id, post.id, 'disagree', requestId), status(409))
  await setReaction(author.user.id, post.id, null, randomUUID())
  await setReaction(author.user.id, post.id, 'agree', requestId)
  assert.deepEqual(await getReactions(post.id, author.user.id), {
    agree: 0,
    disagree: 1,
    mine: null,
  })
  await setReaction(author.user.id, post.id, null, randomUUID())
  assert.equal((await getDatabase().select().from(feedbackReaction)).length, 1)
})

test('chronological comment pagination preserves timestamp ties and direct links resolve beyond the first page', async () => {
  const { commenter, post } = await discussion()
  const comments = await getDatabase()
    .insert(feedbackComment)
    .values(
      Array.from({ length: 5 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        postId: post.id,
        authorId: commenter.user.id,
        body: `Comment ${index + 1}`,
        createdAt: new Date('2026-01-01T12:00:00.123Z'),
      })),
    )
    .returning()
  await getDatabase().execute(
    sql`update ${feedbackComment} set created_at = '2026-01-01T12:00:00.1234Z'::timestamptz`,
  )
  const first = await listComments(post.id, { limit: 2 })
  assert.ok(first.nextCursor)
  const second = await listComments(post.id, {
    limit: 2,
    cursor: JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString()),
  })
  assert.ok(second.nextCursor)
  const third = await listComments(post.id, {
    limit: 2,
    cursor: JSON.parse(Buffer.from(second.nextCursor, 'base64url').toString()),
  })
  assert.equal(third.nextCursor, null)
  assert.deepEqual(
    [...first.comments, ...second.comments, ...third.comments].map((comment) => comment.id),
    comments.map((comment) => comment.id).sort(),
  )
  const last = comments.at(-1)!
  assert.equal((await getComment(post.id, last.id))?.body, last.body)
  await assert.rejects(listComments(randomUUID()), status(404))
  await assert.rejects(getReactions(randomUUID()), status(404))
})

test('reaction counts and viewer choice share one snapshot during a concurrent reaction', async (t) => {
  const { author, post } = await discussion()
  const writer = new Client({ connectionString: process.env.OPINE_TEST_DATABASE_URL })
  await writer.connect()
  let inserted = false
  const execute = NodePgPreparedQuery.prototype.execute
  t.mock.method(
    NodePgPreparedQuery.prototype,
    'execute',
    async function (
      this: typeof NodePgPreparedQuery.prototype,
      ...args: Parameters<typeof execute>
    ) {
      const result = await execute.apply(this, args)
      // Commit immediately after the first reaction projection, before any second SELECT.
      if (!inserted && Array.isArray(result) && (result.length === 0 || 'agree' in result[0])) {
        inserted = true
        await writer.query(
          "insert into feedback_reaction (post_id, user_id, kind) values ($1, $2, 'agree')",
          [post.id, author.user.id],
        )
      }
      return result
    },
  )
  try {
    assert.deepEqual(await getReactions(post.id, author.user.id), {
      agree: 0,
      disagree: 0,
      mine: null,
    })
    assert.ok(inserted)
    assert.deepEqual(await getReactions(post.id, author.user.id), {
      agree: 1,
      disagree: 0,
      mine: 'agree',
    })
  } finally {
    await writer.end()
  }
})
