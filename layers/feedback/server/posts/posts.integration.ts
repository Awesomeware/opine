import { defaultFeedbackTags } from './tags.ts'
import { eq, sql } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { Client } from 'pg'
import { eventLog } from '../../../../server/events/schema.ts'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createFeedbackPost } from '../../tests/fixtures.ts'
import { feedbackFollow, feedbackPost, feedbackPostTag, feedbackTag } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { createPost } from './creation.ts'
import { editPost } from './editing.ts'
import { getPost, listPosts } from './queries.ts'

assert.ok(process.env.OPINE_TEST_DATABASE_URL, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackPost)
  await database.delete(feedbackTag)
  await database.insert(feedbackTag).values(defaultFeedbackTags)
  await database.delete(eventLog)
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
  const result = await createPost(member.user.id, {
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
      'lockedAt',
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
    ].sort(),
  )
  const creationEvents = await getDatabase().select().from(eventLog)
  assert.deepEqual(creationEvents.map((event) => event.eventType).sort(), [
    'post.created',
    'post.followed',
  ])
  assert.ok(creationEvents.every((event) => event.actorId === member.user.id))
  assert.ok(
    creationEvents.every(
      (event) => JSON.stringify(event.details) === JSON.stringify({ postId: result.id }),
    ),
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
  assert.ok(
    await createPost(member.user.id, {
      title: 'Submission after rollback',
      description: 'A failed write does not consume the cooldown.',
      desiredImprovement: null,
    }),
  )
})

test('newest pagination preserves ties and database timestamp precision without repeats or omissions', async () => {
  const member = await createMember()
  const defaults = { authorId: member.user.id }
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
  const maximum = 1
  const results = await Promise.allSettled(
    Array.from({ length: maximum + 2 }, () =>
      createPost(member.user.id, {
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

test('post cooldown timestamps begin after waiting for the creation lock', async () => {
  const member = await createMember()
  const blocker = new Client({ connectionString: process.env.OPINE_TEST_DATABASE_URL })
  await blocker.connect()
  let pending: ReturnType<typeof createPost> | undefined
  try {
    await blocker.query('begin')
    const { rows } = await blocker.query('select pg_backend_pid() as pid')
    await blocker.query('select id from auth_user where id = $1 for no key update', [
      member.user.id,
    ])
    pending = createPost(member.user.id, {
      title: 'Wait for the creation lock',
      description: 'The cooldown starts when this post is written.',
      desiredImprovement: null,
    })
    const deadline = Date.now() + 5000
    let waiting = false
    while (Date.now() < deadline) {
      const blocked = await blocker.query(
        'select 1 from pg_stat_activity where $1::integer = any(pg_blocking_pids(pid))',
        [rows[0].pid],
      )
      if (blocked.rowCount) {
        waiting = true
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.ok(waiting, 'Creation must be waiting on the actor lock')
    const releasedAt = new Date()
    await blocker.query('commit')
    const result = await pending
    assert.ok(result)
    const stored = await getPost(result.id)
    assert.ok(stored && stored.createdAt >= releasedAt)
    assert.deepEqual(stored.updatedAt, stored.createdAt)
  } finally {
    await blocker.query('rollback')
    await pending?.catch(() => {})
    await blocker.end()
  }
})

function status(code: number) {
  return (error: unknown) => error instanceof FeedbackWriteError && error.statusCode === code
}

test('post cooldown rejects repeat submissions and expires from the stored timestamp', async () => {
  const author = await createMember()
  const input = {
    title: 'Improve navigation',
    description: 'Make paths easier to read.',
    desiredImprovement: null,
  }
  const post = await createPost(author.user.id, input)
  assert.ok(post)
  await assert.rejects(createPost(author.user.id, input), (error: unknown) => {
    assert.ok(error instanceof FeedbackWriteError)
    assert.equal(error.statusCode, 429)
    assert.ok(error.retryAfterSeconds! > 0 && error.retryAfterSeconds! <= 60)
    return true
  })
  await getDatabase()
    .update(feedbackPost)
    .set({ createdAt: new Date(Date.now() - 61_000) })
    .where(eq(feedbackPost.id, post.id))
  assert.ok(await createPost(author.user.id, input))
  assert.equal((await getDatabase().select().from(feedbackPost)).length, 2)
})

test('authors edit current post content only, unchanged saves do not mark edits, and stale writers conflict', async () => {
  const author = await createMember()
  const commenter = await createMember()
  const post = await createFeedbackPost({ authorId: author.user.id })
  const original = {
    title: post.title,
    description: post.description,
    desiredImprovement: post.desiredImprovement,
    version: 1,
  }
  await assert.rejects(editPost(commenter.user.id, post.id, original), status(403))
  assert.deepEqual(await editPost(author.user.id, post.id, original), {
    id: post.id,
    version: 1,
  })
  assert.equal((await getPost(post.id))?.editedAt, null)
  const input = { ...original, title: 'A clearer combat indicator' }
  const updated = await editPost(author.user.id, post.id, input)
  assert.equal(updated.version, 2)
  const [event] = await getDatabase()
    .select()
    .from(eventLog)
    .where(eq(eventLog.eventType, 'post.edited'))
  assert.equal(event!.actorId, author.user.id)
  assert.deepEqual(event!.details, { postId: post.id, version: 2, changedFields: ['title'] })
  await assert.rejects(editPost(author.user.id, post.id, original), status(409))
  await assert.rejects(editPost(author.user.id, post.id, input), status(409))
  const current = await getPost(post.id, author.user.id)
  assert.ok(current?.editedAt)
  assert.equal(current.title, input.title)
  assert.equal(current.status, 'new')
  assert.equal(current.canEdit, true)
  assert.equal((await getPost(post.id, commenter.user.id))?.canEdit, false)
  const outcomes = await Promise.allSettled(
    ['First writer', 'Second writer'].map((title) =>
      editPost(author.user.id, post.id, { ...input, title, version: 2 }),
    ),
  )
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = outcomes.find((result) => result.status === 'rejected')
  assert.ok(rejected && status(409)(rejected.reason))
  assert.equal((await getPost(post.id))?.version, 3)
})

test('posts need no classification and referenced authors cannot be deleted', async () => {
  const member = await createMember()
  const post = await createFeedbackPost({ authorId: member.user.id })
  assert.deepEqual((await getPost(post.id))?.tags, [])
  await assert.rejects(
    getDatabase().delete(user).where(eq(user.id, member.user.id)),
    foreignKeyViolation,
  )
})

test('search combines literal text, tag and status filters without duplicate posts', async () => {
  const member = await createMember()
  const database = getDatabase()
  const [combat, gameplay] = await database
    .insert(feedbackTag)
    .values([{ name: 'Test combat' }, { name: 'Test gameplay' }])
    .returning()
  const defaults = { authorId: member.user.id }
  const match = await createFeedbackPost({ ...defaults, title: '100%_clear', status: 'planned' })
  const wildcard = await createFeedbackPost({ ...defaults, title: '100XXclear', status: 'planned' })
  const newPost = await createFeedbackPost({
    ...defaults,
    title: '100%_clear again',
    status: 'new',
  })
  await createFeedbackPost({ ...defaults, title: '100%_clear without tags', status: 'planned' })
  await database
    .insert(feedbackPostTag)
    .values([
      ...[match, wildcard, newPost].map((post) => ({ postId: post.id, tagId: combat!.id })),
      { postId: match.id, tagId: gameplay!.id },
    ])
  const result = await listPosts({ q: '100%_clear', tagId: combat!.id, status: 'planned' })
  assert.deepEqual(
    result.posts.map((post) => post.id),
    [match.id],
  )
  assert.equal(result.posts[0]!.tags.length, 2)
  assert.equal(result.nextCursor, null)
  assert.equal((await listPosts({ q: 'hit connects', tagId: combat!.id })).posts.length, 3)
  assert.equal((await listPosts({ q: "' OR true --" })).posts.length, 0)
  assert.equal((await listPosts({ tagId: randomUUID() })).posts.length, 0)
})
