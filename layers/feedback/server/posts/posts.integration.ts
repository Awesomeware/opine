import { eq, sql } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../tests/fixtures.ts'
import { feedbackCategory, feedbackFollow, feedbackPost, feedbackWriteReceipt } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { listCategories } from './categories.ts'
import { createPost } from './creation.ts'
import { editPost } from './editing.ts'
import { getPost, listPosts } from './queries.ts'

assert.ok(process.env.OPINE_TEST_DATABASE_URL, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackPost)
  await database.delete(feedbackCategory)
  await database.delete(user)
})

function foreignKeyViolation(error: unknown) {
  return (
    error instanceof Error &&
    error.cause instanceof Error &&
    'code' in error.cause &&
    (error.cause.code === '23503' || error.cause.code === '23001')
  )
}

test('submission persists the author follow and exposes only public author information', async () => {
  const member = await createMember({ name: 'A Player' })
  const category = await createCategory()
  const result = await createPost(member.user.id, {
    categoryId: category.id,
    title: 'Clearer combat feedback',
    description: 'I cannot tell when a hit connects.',
    desiredImprovement: 'Show a hit indicator.',
  })
  assert.ok(result)
  const [stored] = await getDatabase().select().from(feedbackPost)
  assert.equal(stored?.status, 'new')
  assert.equal(stored?.authorId, member.user.id)
  assert.deepEqual(
    await getDatabase()
      .select({ postId: feedbackFollow.postId, userId: feedbackFollow.userId })
      .from(feedbackFollow),
    [{ postId: result.id, userId: member.user.id }],
  )
  await closeDatabase()
  const post = await getPost(result.id)
  assert.ok(post)
  assert.equal(post.id, result.id)
  assert.equal(post.title, 'Clearer combat feedback')
  assert.deepEqual(
    Object.keys(post).sort(),
    [
      'id',
      'title',
      'tags',
      'description',
      'desiredImprovement',
      'status',
      'createdAt',
      'updatedAt',
      'editedAt',
      'version',
      'canEdit',
      'author',
      'category',
    ].sort(),
  )
  assert.deepEqual(post.author, { name: 'A Player' })
  const publicOutput = JSON.stringify({ post, list: await listPosts({}) })
  assert.ok(publicOutput.includes('A Player'))
  assert.ok(!publicOutput.includes(member.user.email))
  assert.ok(!publicOutput.includes(member.session.token))
  assert.ok(!publicOutput.includes('emailVerified'))
  assert.equal(await getPost(randomUUID()), undefined)
})

test('a failed automatic follow rolls back the whole submission', async () => {
  const member = await createMember()
  const category = await createCategory()
  const database = getDatabase()
  await database.execute(
    sql`create function reject_test_follow() returns trigger language plpgsql as $$ begin raise exception 'Simulated follow failure'; end $$`,
  )
  try {
    await database.execute(
      sql`create trigger reject_test_follow before insert on feedback_follow for each row execute function reject_test_follow()`,
    )
    try {
      await assert.rejects(
        createPost(member.user.id, {
          categoryId: category.id,
          title: 'Atomic submission',
          description: 'A post must never survive without its initial author follow.',
          desiredImprovement: null,
        }),
      )
      assert.equal((await database.select().from(feedbackPost)).length, 0)
      assert.equal((await database.select().from(feedbackFollow)).length, 0)
    } finally {
      await database.execute(sql`drop trigger reject_test_follow on feedback_follow`)
    }
  } finally {
    await database.execute(sql`drop function reject_test_follow()`)
  }
})

test('inactive categories cannot receive submissions and referenced authors and categories cannot be deleted', async () => {
  const member = await createMember()
  const active = await createCategory({ name: 'World', sortOrder: 2 })
  const inactive = await createCategory({ name: 'Retired', isActive: false, sortOrder: 1 })
  const input = {
    title: 'A clearer map',
    description: 'The map is hard to read.',
    desiredImprovement: null,
  }
  assert.equal(await createPost(member.user.id, { ...input, categoryId: inactive.id }), null)
  assert.equal(await createPost(member.user.id, { ...input, categoryId: randomUUID() }), null)
  assert.equal((await getDatabase().select().from(feedbackPost)).length, 0)
  assert.equal((await getDatabase().select().from(feedbackFollow)).length, 0)
  const result = await createPost(member.user.id, { ...input, categoryId: active.id })
  assert.ok(result)
  await assert.rejects(
    getDatabase().delete(user).where(eq(user.id, member.user.id)),
    foreignKeyViolation,
  )
  await assert.rejects(
    getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, active.id)),
    foreignKeyViolation,
  )
  assert.ok(await getPost(result.id))
  await getDatabase()
    .update(feedbackCategory)
    .set({ isActive: false })
    .where(eq(feedbackCategory.id, active.id))
  assert.equal(await createPost(member.user.id, { ...input, categoryId: active.id }), null)
  assert.equal((await listPosts({ category: active.slug })).posts.length, 1)
  const categories = await listCategories()
  assert.ok(categories.some((category) => category.id === active.id))
})

test('search treats wildcard characters literally and combines category and status filters', async () => {
  const member = await createMember()
  const combat = await createCategory({ slug: 'combat' })
  const world = await createCategory({ slug: 'world' })
  const defaults = { authorId: member.user.id, categoryId: combat.id }
  const match = await createFeedbackPost({ ...defaults, title: '100%_clear', status: 'planned' })
  await createFeedbackPost({ ...defaults, title: '100XXclear', status: 'planned' })
  await createFeedbackPost({ ...defaults, title: '100%_clear again', status: 'new' })
  await createFeedbackPost({
    ...defaults,
    categoryId: world.id,
    title: '100%_clear world',
    status: 'planned',
  })
  const result = await listPosts({ q: '100%_clear', category: 'combat', status: 'planned' })
  assert.deepEqual(
    result.posts.map((post) => post.id),
    [match.id],
  )
  assert.equal(result.nextCursor, null)
  assert.equal((await listPosts({ q: 'hit connects', category: 'combat' })).posts.length, 3)
  assert.equal((await listPosts({ q: "' OR true --" })).posts.length, 0)
})

test('newest pagination preserves ties and database timestamp precision without repeats or omissions', async () => {
  const member = await createMember()
  const category = await createCategory()
  const defaults = { authorId: member.user.id, categoryId: category.id }
  const sameTime = new Date('2026-01-01T12:00:00.123Z')
  const posts = []
  for (let index = 1; index <= 5; index++) {
    posts.push(
      await createFeedbackPost({
        ...defaults,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        createdAt: sameTime,
      }),
    )
  }
  await getDatabase().execute(
    sql`update ${feedbackPost} set created_at = '2026-01-01T12:00:00.1234Z'::timestamptz`,
  )
  const newest = await createFeedbackPost({
    ...defaults,
    createdAt: new Date('2026-01-01T12:00:01Z'),
  })
  const first = await listPosts({ limit: 2 })
  assert.ok(first.nextCursor)
  const second = await listPosts({
    limit: 2,
    cursor: JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString()),
  })
  assert.ok(second.nextCursor)
  const third = await listPosts({
    limit: 2,
    cursor: JSON.parse(Buffer.from(second.nextCursor, 'base64url').toString()),
  })
  assert.equal(third.nextCursor, null)
  assert.deepEqual(
    [...first.posts, ...second.posts, ...third.posts].map((post) => post.id),
    [newest.id, ...posts.reverse().map((post) => post.id)],
  )
})

test('concurrent submissions cannot exceed the per-member allowance', async () => {
  const member = await createMember()
  const category = await createCategory()
  const maximum = Number(process.env.FEEDBACK_POST_MAX ?? 5)
  const results = await Promise.allSettled(
    Array.from({ length: maximum + 2 }, () =>
      createPost(member.user.id, {
        categoryId: category.id,
        title: 'Rate-limited feedback',
        description: 'Concurrent requests must share the same submission allowance.',
        desiredImprovement: null,
      }),
    ),
  )
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, maximum)
  const failures = results.filter((result) => result.status === 'rejected')
  assert.equal(failures.length, 2)
  for (const failure of failures)
    assert.ok(failure.reason instanceof FeedbackWriteError && failure.reason.statusCode === 429)
  assert.equal((await getDatabase().select().from(feedbackPost)).length, maximum)
  assert.equal((await getDatabase().select().from(feedbackFollow)).length, maximum)
})

test('operator category changes preserve references and disabling prevents new submissions', async () => {
  const member = await createMember()
  const category = await createCategory({ slug: 'combat' })
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  const execute = promisify(execFile)
  const script = fileURLToPath(new URL('../../../../scripts/feedback-category.ts', import.meta.url))
  const result = await execute(process.execPath, [
    script,
    'upsert',
    'combat',
    'Combat and abilities',
    '3',
  ])
  assert.match(result.stdout, /Category saved/)
  const updated = await getPost(post.id)
  assert.equal(updated?.category.id, category.id)
  assert.equal(updated?.category.name, 'Combat and abilities')
  await execute(process.execPath, [script, 'disable', 'combat'])
  assert.equal(
    await createPost(member.user.id, {
      categoryId: category.id,
      title: 'Another post',
      description: 'This category is no longer accepting submissions.',
      desiredImprovement: null,
    }),
    null,
  )
  assert.ok(await getPost(post.id))
  await assert.rejects(execute(process.execPath, [script, 'disable', 'missing']), { code: 1 })
})

function status(code: number) {
  return (error: unknown) => error instanceof FeedbackWriteError && error.statusCode === code
}

test('post retries create one post and follow, reject changed input, and bypass an exhausted allowance', async () => {
  const author = await createMember()
  const category = await createCategory()
  const input = {
    categoryId: category.id,
    title: 'Improve navigation',
    description: 'Make paths easier to read.',
    desiredImprovement: null,
  }
  const requestId = randomUUID()
  const replies = await Promise.all(
    Array.from({ length: 4 }, () => createPost(author.user.id, input, requestId)),
  )
  assert.ok(replies[0])
  for (const reply of replies) assert.deepEqual(reply, replies[0])
  assert.equal((await getDatabase().select().from(feedbackPost)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackFollow)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackWriteReceipt)).length, 1)
  await assert.rejects(
    createPost(author.user.id, { ...input, title: 'Different request' }, requestId),
    status(409),
  )
  const maximum = Number(process.env.FEEDBACK_POST_MAX ?? 5)
  for (let i = 1; i < maximum; i++) await createPost(author.user.id, input, randomUUID())
  assert.deepEqual(await createPost(author.user.id, input, requestId), replies[0])
})

test('authors edit current post content only, unchanged saves do not mark edits, and stale writers conflict', async () => {
  const author = await createMember()
  const commenter = await createMember()
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: author.user.id, categoryId: category.id })
  const original = {
    title: post.title,
    description: post.description,
    desiredImprovement: post.desiredImprovement,
    version: 1,
  }
  await assert.rejects(editPost(commenter.user.id, post.id, original, randomUUID()), status(403))
  assert.deepEqual(await editPost(author.user.id, post.id, original, randomUUID()), {
    id: post.id,
    version: 1,
  })
  assert.equal((await getPost(post.id))?.editedAt, null)
  const input = { ...original, title: 'A clearer combat indicator' }
  const requestId = randomUUID()
  const updated = await editPost(author.user.id, post.id, input, requestId)
  assert.equal(updated.version, 2)
  assert.deepEqual(await editPost(author.user.id, post.id, input, requestId), updated)
  const current = await getPost(post.id, author.user.id)
  assert.ok(current?.editedAt)
  assert.equal(current.title, input.title)
  assert.equal(current.category.id, category.id)
  assert.equal(current.status, 'new')
  assert.equal(current.canEdit, true)
  assert.equal((await getPost(post.id, commenter.user.id))?.canEdit, false)
  const outcomes = await Promise.allSettled(
    ['First writer', 'Second writer'].map((title) =>
      editPost(author.user.id, post.id, { ...input, title, version: 2 }, randomUUID()),
    ),
  )
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = outcomes.find((result) => result.status === 'rejected')
  assert.ok(rejected && status(409)(rejected.reason))
  assert.equal((await getPost(post.id))?.version, 3)
  const receipts = await getDatabase().select().from(feedbackWriteReceipt)
  assert.ok(
    !JSON.stringify(receipts).includes(post.description),
    'Receipts must not archive content',
  )
})
