import { NodePgPreparedQuery } from 'drizzle-orm/node-postgres/session'
import { Client } from 'pg'
import {
  withMigrationDatabase,
  applyMigrations,
} from '../../../tests/helpers/migration-database.ts'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import { setUserRole } from '../../auth/server/roles.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../tests/fixtures.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackPost,
  feedbackWriteReceipt,
  feedbackOfficialResponse,
  feedbackNotification,
  feedbackCategoryChange,
  feedbackFollow,
} from './schema.ts'
import {
  publishResponse,
  getOutcome,
  getOfficialResponse,
  setFollowing,
  correctCategory,
  listCategoryHistory,
  listDiscussion,
  listReviewQueue,
  listNotifications,
  markNotificationRead,
} from './outcomes.ts'
import { createComment, editPost } from './participation.ts'
import { FeedbackWriteError } from './writes.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)
after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(feedbackNotification)
  await database.delete(feedbackOfficialResponse)
  await database.delete(feedbackCategoryChange)
  await database.delete(feedbackComment)
  await database.delete(feedbackWriteReceipt)
  await database.delete(feedbackPost)
  await database.delete(feedbackCategory)
  await database.delete(user)
})

function cursor(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString())
}

function status(code: number) {
  return (error: unknown) => error instanceof FeedbackWriteError && error.statusCode === code
}

async function discussion() {
  const author = await createMember({ name: 'Post author' })
  const manager = await createMember({ name: 'Community manager', roles: ['community-manager'] })
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: author.user.id, categoryId: category.id })
  return { author, manager, category, post }
}

// Keep the suite's container while exercising a real upgrade from the prior schema.
test('the outcomes migration preserves existing posts, comments, follows, and receipts', async () => {
  await withMigrationDatabase(async (isolated) => {
    await applyMigrations(isolated, 0, 4)
    const actorId = randomUUID()
    const postId = randomUUID()
    const commentId = randomUUID()
    await isolated.query('insert into auth_user (id, name, email) values ($1, $2, $3)', [
      actorId,
      'Existing author',
      'existing@example.test',
    ])
    await isolated.query(
      "insert into feedback_post (id, author_id, category_id, title, description, version) select $1, $2, id, 'Existing proposal', 'Preserve this feedback', 3 from feedback_category limit 1",
      [postId, actorId],
    )
    await isolated.query(
      "insert into feedback_comment (id, post_id, author_id, body, type) values ($1, $2, $3, 'Existing question', 'question')",
      [commentId, postId, actorId],
    )
    await isolated.query('insert into feedback_follow (post_id, user_id) values ($1, $2)', [
      postId,
      actorId,
    ])
    await isolated.query(
      'insert into feedback_write_receipt (actor_id, request_id, operation, request_hash, result) values ($1, $2, $3, $4, $5)',
      [actorId, randomUUID(), 'create-comment', 'existing-hash', { id: commentId, version: 1 }],
    )
    const beforePost = (await isolated.query('select * from feedback_post')).rows[0]
    const preserved = ['feedback_comment', 'feedback_follow', 'feedback_write_receipt']
    const before = await Promise.all(
      preserved.map(async (table) => (await isolated.query(`select * from ${table}`)).rows),
    )
    await applyMigrations(isolated, 4)
    const afterPost = (await isolated.query('select * from feedback_post')).rows[0]
    for (const [key, value] of Object.entries(beforePost)) assert.deepEqual(afterPost[key], value)
    assert.equal(afterPost.workflow_version, 1)
    for (const [index, table] of preserved.entries())
      assert.deepEqual((await isolated.query(`select * from ${table}`)).rows, before[index])
  })
})

test('official publication atomically changes status and notifies each follower once across concurrent retries', async () => {
  const { author, manager, post } = await discussion()
  await setFollowing(author.user.id, post.id, true, randomUUID())
  await setFollowing(manager.user.id, post.id, true, randomUUID())
  const input = {
    body: 'We are reviewing this feedback.',
    status: 'reviewing' as const,
    version: 1,
  }
  const key = randomUUID()
  const results = await Promise.all(
    Array.from({ length: 4 }, () => publishResponse(manager.user.id, post.id, input, key)),
  )
  for (const result of results) assert.deepEqual(result, results[0])
  const database = getDatabase()
  const responses = await database.select().from(feedbackOfficialResponse)
  assert.equal(responses.length, 1)
  assert.equal(responses[0]!.previousStatus, 'new')
  assert.equal(responses[0]!.status, 'reviewing')
  const notifications = await database.select().from(feedbackNotification)
  assert.equal(notifications.length, 2)
  assert.deepEqual(
    new Set(notifications.map((row) => row.userId)),
    new Set([author.user.id, manager.user.id]),
  )
  assert.ok(notifications.every((row) => row.responseId === results[0]!.id))
  const outcome = await getOutcome(post.id, manager.user.id)
  assert.equal(outcome?.status, 'reviewing')
  assert.equal(outcome?.latestResponse?.id, results[0]!.id)
  assert.equal(outcome?.statusResponse?.id, results[0]!.id)
  assert.equal(outcome?.canRespond, true)
  await assert.rejects(
    publishResponse(manager.user.id, post.id, { ...input, body: 'Changed' }, key),
    status(409),
  )
  await setUserRole(manager.user.id, 'community-manager', false)
  await assert.rejects(publishResponse(manager.user.id, post.id, input, key), status(403))
  assert.equal((await getOutcome(post.id, manager.user.id))?.canRespond, false)
  const administrator = await createMember({ roles: ['administrator'] })
  await assert.rejects(
    publishResponse(administrator.user.id, post.id, input, randomUUID()),
    status(403),
  )
  await assert.rejects(publishResponse(author.user.id, post.id, input, randomUUID()), status(403))
  const publicResponse = await getOfficialResponse(post.id, results[0]!.id)
  assert.deepEqual(publicResponse?.author, { name: 'Community manager' })
  for (const privateValue of [manager.user.email, manager.user.id, manager.session.token])
    assert.ok(!JSON.stringify(publicResponse).includes(privateValue))
  assert.equal(await getOfficialResponse(randomUUID(), results[0]!.id), undefined)
})

test('notification failure rolls back response, status, and receipt so the original request can retry', async () => {
  const { author, manager, post } = await discussion()
  await setFollowing(author.user.id, post.id, true, randomUUID())
  const database = getDatabase()
  const key = randomUUID()
  const input = { body: 'This is now planned.', status: 'planned' as const, version: 1 }
  await database.execute(
    sql`create function reject_test_notification() returns trigger language plpgsql as $$ begin raise exception 'Simulated notification failure'; end $$`,
  )
  try {
    await database.execute(
      sql`create trigger reject_test_notification before insert on feedback_notification for each row execute function reject_test_notification()`,
    )
    try {
      await assert.rejects(publishResponse(manager.user.id, post.id, input, key))
      assert.equal((await database.select().from(feedbackOfficialResponse)).length, 0)
      assert.equal((await database.select().from(feedbackNotification)).length, 0)
      assert.equal(
        (
          await database
            .select()
            .from(feedbackWriteReceipt)
            .where(eq(feedbackWriteReceipt.requestId, key))
        ).length,
        0,
      )
      const outcome = await getOutcome(post.id)
      assert.equal(outcome?.status, 'new')
      assert.equal(outcome?.version, 1)
    } finally {
      await database.execute(sql`drop trigger reject_test_notification on feedback_notification`)
    }
  } finally {
    await database.execute(sql`drop function reject_test_notification()`)
  }
  await publishResponse(manager.user.id, post.id, input, key)
  assert.equal((await database.select().from(feedbackNotification)).length, 1)
})

test('workflow conflicts serialize managers while author edits and later responses preserve the current explanation', async () => {
  const { author, manager, post } = await discussion()
  const other = await createMember({ roles: ['community-manager'] })
  // Both representatives follow: publishing must not deadlock on each other's recipient rows.
  await setFollowing(manager.user.id, post.id, true, randomUUID())
  await setFollowing(other.user.id, post.id, true, randomUUID())
  const results = await Promise.allSettled(
    [manager, other].map((actor) =>
      publishResponse(
        actor.user.id,
        post.id,
        { body: 'We acknowledge the issue.', status: 'reviewing', version: 1 },
        randomUUID(),
      ),
    ),
  )
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.ok(rejected && status(409)(rejected.reason))
  const acknowledged = await getOutcome(post.id)
  assert.equal(acknowledged?.version, 2)
  const edited = await editPost(
    author.user.id,
    post.id,
    {
      title: 'Clarified original feedback',
      description: post.description,
      desiredImprovement: null,
      version: 1,
    },
    randomUUID(),
  )
  assert.equal(edited.version, 2)
  assert.equal((await getOutcome(post.id))?.version, 2)
  // A waiting/rounded timestamp may be ahead of the app clock. The next response
  // must still follow every prior comment so it clears the follow-up queue.
  const priorCommentTime = new Date(Date.now() + 1000)
  await getDatabase().insert(feedbackComment).values({
    postId: post.id,
    authorId: author.user.id,
    body: 'A detail before the next response',
    type: 'context',
    createdAt: priorCommentTime,
  })
  const later = await publishResponse(
    manager.user.id,
    post.id,
    { body: 'Here is an additional detail.', version: 2 },
    randomUUID(),
  )
  const current = await getOutcome(post.id)
  assert.equal(current?.version, 3)
  assert.equal(current?.status, 'reviewing')
  assert.equal(current?.latestResponse?.id, later.id)
  assert.ok(current.latestResponse.createdAt.getTime() > priorCommentTime.getTime())
  assert.equal(
    (await listReviewQueue(manager.user.id, { status: 'all', followUp: true })).posts.length,
    0,
  )
  assert.equal(current?.latestResponse?.status, null)
  assert.equal(current?.statusResponse?.id, acknowledged?.statusResponse?.id)
  await createComment(
    author.user.id,
    post.id,
    { body: 'Thank you for reviewing.', type: 'context' },
    randomUUID(),
  )
  assert.equal(
    (await listReviewQueue(manager.user.id, { status: 'all', followUp: true })).posts.length,
    1,
  )
  assert.equal((await getDatabase().select().from(feedbackNotification)).length, 4)
})

test('following is explicit and retry-safe, inboxes stay private, and unfollowing preserves received notifications', async () => {
  const { author, manager, post } = await discussion()
  const outsider = await createMember()
  const key = randomUUID()
  await Promise.all(
    Array.from({ length: 3 }, () => setFollowing(author.user.id, post.id, true, key)),
  )
  assert.equal((await getDatabase().select().from(feedbackFollow)).length, 1)
  await setFollowing(author.user.id, post.id, true, randomUUID())
  const response = await publishResponse(
    manager.user.id,
    post.id,
    { body: 'First response', version: 1 },
    randomUUID(),
  )
  await publishResponse(
    manager.user.id,
    post.id,
    { body: 'Second response', version: 2 },
    randomUUID(),
  )
  const first = await listNotifications(author.user.id, { limit: 1 })
  assert.equal(first.notifications.length, 1)
  assert.equal(first.unreadCount, 2)
  assert.ok(first.nextCursor)
  const second = await listNotifications(author.user.id, {
    limit: 1,
    cursor: cursor(first.nextCursor),
  })
  assert.equal(second.notifications.length, 1)
  assert.equal(second.nextCursor, null)
  assert.notEqual(first.notifications[0]!.id, second.notifications[0]!.id)
  assert.ok(
    [...first.notifications, ...second.notifications].some((row) => row.responseId === response.id),
  )
  assert.equal((await listNotifications(outsider.user.id)).notifications.length, 0)
  const notificationId = first.notifications[0]!.id
  await assert.rejects(
    markNotificationRead(outsider.user.id, notificationId, randomUUID()),
    status(404),
  )
  const readKey = randomUUID()
  await markNotificationRead(author.user.id, notificationId, readKey)
  await markNotificationRead(author.user.id, notificationId, readKey)
  const unread = await listNotifications(author.user.id, { unread: true })
  assert.equal(unread.unreadCount, 1)
  assert.equal(unread.notifications.length, 1)
  await setFollowing(author.user.id, post.id, false, randomUUID())
  await publishResponse(
    manager.user.id,
    post.id,
    { body: 'Third response after unfollow', version: 3 },
    randomUUID(),
  )
  assert.equal((await listNotifications(author.user.id)).notifications.length, 2)
  assert.equal((await getOutcome(post.id, author.user.id))?.following, false)
})

test('All merges ordinary comments and official responses with stable bounded pagination and independent direct links', async () => {
  const { author, manager, post } = await discussion()
  const database = getDatabase()
  const createdAt = new Date('2026-02-01T12:00:00.123Z')
  const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  await database.insert(feedbackComment).values([
    {
      id: id(1),
      postId: post.id,
      authorId: author.user.id,
      body: 'Ordinary question',
      type: 'question',
      createdAt,
    },
    {
      id: id(3),
      postId: post.id,
      authorId: manager.user.id,
      body: 'A personal suggestion from a manager',
      type: 'suggestion',
      createdAt,
    },
    {
      id: id(5),
      postId: post.id,
      authorId: author.user.id,
      body: 'Older unclassified contribution',
      createdAt,
    },
  ])
  await database.insert(feedbackOfficialResponse).values(
    [2, 4].map((index) => ({
      id: id(index),
      postId: post.id,
      authorId: manager.user.id,
      body: `Official response ${index}`,
      createdAt,
    })),
  )
  const seen: string[] = []
  let next: string | null = null
  do {
    const page = await listDiscussion(post.id, {
      limit: 2,
      ...(next ? { cursor: cursor(next) } : {}),
    })
    assert.ok(page.entries.length <= 2)
    seen.push(
      ...page.entries.map((entry) =>
        entry.kind === 'comment' ? entry.comment.id : entry.response.id,
      ),
    )
    next = page.nextCursor
  } while (next)
  assert.deepEqual(seen, [1, 2, 3, 4, 5].map(id))
  const team = await listDiscussion(post.id, { type: 'team', limit: 1 })
  assert.equal(team.entries[0]?.kind, 'response')
  assert.ok(team.nextCursor)
  const nextTeam = await listDiscussion(post.id, {
    type: 'team',
    limit: 1,
    cursor: cursor(team.nextCursor),
  })
  assert.equal(nextTeam.entries.length, 1)
  assert.equal(nextTeam.nextCursor, null)
  const suggestions = await listDiscussion(post.id, { type: 'suggestion' })
  assert.equal(suggestions.entries.length, 1)
  assert.equal(suggestions.entries[0]?.kind, 'comment')
  assert.equal((await getOfficialResponse(post.id, id(2)))?.body, 'Official response 2')
})

test('the review queue defaults to oldest New posts and follow-up excludes managers and unanswered posts', async () => {
  const { author, manager, category, post } = await discussion()
  const database = getDatabase()
  const otherCategory = await createCategory()
  const oldest = await createFeedbackPost({
    authorId: author.user.id,
    categoryId: category.id,
    createdAt: new Date('2020-01-01'),
  })
  const second = await createFeedbackPost({
    authorId: author.user.id,
    categoryId: otherCategory.id,
    createdAt: new Date('2020-01-02'),
  })
  const initial = await listReviewQueue(manager.user.id, { limit: 1 })
  assert.deepEqual(
    initial.posts.map((row) => row.id),
    [oldest.id],
  )
  assert.ok(initial.nextCursor)
  const following = await listReviewQueue(manager.user.id, {
    limit: 1,
    cursor: cursor(initial.nextCursor),
  })
  assert.deepEqual(
    following.posts.map((row) => row.id),
    [second.id],
  )
  assert.deepEqual(
    (await listReviewQueue(manager.user.id, { category: otherCategory.slug })).posts.map(
      (row) => row.id,
    ),
    [second.id],
  )
  await assert.rejects(listReviewQueue(author.user.id), status(403))
  const administrator = await createMember({ roles: ['administrator'] })
  await assert.rejects(listReviewQueue(administrator.user.id), status(403))
  await publishResponse(
    manager.user.id,
    oldest.id,
    { body: 'Under review', status: 'reviewing', version: 1 },
    randomUUID(),
  )
  const officialTime = new Date('2021-01-01')
  await database
    .update(feedbackOfficialResponse)
    .set({ createdAt: officialTime })
    .where(eq(feedbackOfficialResponse.postId, oldest.id))
  await database.insert(feedbackComment).values([
    {
      postId: oldest.id,
      authorId: manager.user.id,
      body: 'Manager commentary is not follow-up',
      type: 'context',
      createdAt: new Date('2022-01-01'),
    },
    {
      postId: oldest.id,
      authorId: author.user.id,
      body: 'Member comment before response',
      type: 'context',
      createdAt: new Date('2020-06-01'),
    },
    {
      postId: post.id,
      authorId: author.user.id,
      body: 'No response yet',
      type: 'question',
      createdAt: new Date('2022-01-01'),
    },
  ])
  assert.equal(
    (await listReviewQueue(manager.user.id, { followUp: true, status: 'all' })).posts.length,
    0,
  )
  await database.insert(feedbackComment).values({
    postId: oldest.id,
    authorId: author.user.id,
    body: 'Member follow-up',
    type: 'question',
    createdAt: new Date('2022-01-01'),
  })
  assert.deepEqual(
    (await listReviewQueue(manager.user.id, { followUp: true, status: 'all' })).posts.map(
      (row) => row.id,
    ),
    [oldest.id],
  )
  assert.deepEqual(
    (await listReviewQueue(manager.user.id, { status: 'reviewing' })).posts.map((row) => row.id),
    [oldest.id],
  )
  await publishResponse(
    manager.user.id,
    oldest.id,
    { body: 'Answer to follow-up', version: 2 },
    randomUUID(),
  )
  assert.equal(
    (await listReviewQueue(manager.user.id, { followUp: true, status: 'all' })).posts.length,
    0,
  )
})

test('category corrections are authorized, conflict-safe, audited once, and independent of author text edits', async () => {
  const { author, manager, category, post } = await discussion()
  const target = await createCategory()
  const input = { categoryId: target.id, version: 1 }
  await assert.rejects(correctCategory(author.user.id, post.id, input, randomUUID()), status(403))
  const key = randomUUID()
  const result = await correctCategory(manager.user.id, post.id, input, key)
  assert.deepEqual(await correctCategory(manager.user.id, post.id, input, key), result)
  const audit = await getDatabase().select().from(feedbackCategoryChange)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.previousCategoryId, category.id)
  assert.equal(audit[0]!.categoryId, target.id)
  assert.equal(audit[0]!.actorId, manager.user.id)
  assert.equal((await getDatabase().select().from(feedbackPost))[0]!.version, 1)
  await assert.rejects(
    correctCategory(
      manager.user.id,
      post.id,
      { categoryId: category.id, version: 1 },
      randomUUID(),
    ),
    status(409),
  )
  await assert.rejects(listCategoryHistory(author.user.id, post.id), status(403))
  const inactive = await createCategory({ isActive: false })
  await assert.rejects(
    correctCategory(
      manager.user.id,
      post.id,
      { categoryId: inactive.id, version: 2 },
      randomUUID(),
    ),
    status(400),
  )
  assert.equal((await getDatabase().select().from(feedbackNotification)).length, 0)
})

test('discussion pages use one snapshot when publication commits between source reads', async () => {
  const { author, manager, post } = await discussion()
  const writer = new Client({ connectionString: databaseUrl })
  await writer.connect()
  let pending: ReturnType<typeof listDiscussion> | undefined
  try {
    await writer.query('begin')
    // Let the comment SELECT finish, then hold the response SELECT at the table lock.
    await writer.query('lock table feedback_official_response in access exclusive mode')
    pending = listDiscussion(post.id, { limit: 1 })
    const deadline = Date.now() + 4000
    while (true) {
      const waiting = await writer.query(`select 1 from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()
          and wait_event_type = 'Lock' and query like '%feedback_official_response%'
          and query like 'select%'`)
      if (waiting.rowCount) break
      assert.ok(Date.now() < deadline, 'discussion must reach the response SELECT')
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    await writer.query(
      `insert into feedback_comment (post_id, author_id, body, type, created_at)
       values ($1, $2, 'Concurrent comment', 'context', '2026-01-01T00:00:00Z')`,
      [post.id, author.user.id],
    )
    await writer.query(
      `insert into feedback_official_response (post_id, author_id, body, created_at)
       values ($1, $2, 'First response', '2026-01-01T00:00:01Z'),
              ($1, $2, 'Second response', '2026-01-01T00:00:02Z')`,
      [post.id, manager.user.id],
    )
    await writer.query('commit')
    assert.deepEqual(await pending, { entries: [], nextCursor: null })
    const nextRead = await listDiscussion(post.id, { limit: 1 })
    assert.equal(nextRead.entries[0]?.kind, 'comment')
    assert.ok(nextRead.nextCursor)
  } finally {
    await writer.query('rollback')
    await pending?.catch(() => {})
    await writer.end()
  }
})

test('inbox rows and unread count share one snapshot during notification delivery', async (t) => {
  const { author, manager, post } = await discussion()
  const response = await publishResponse(
    manager.user.id,
    post.id,
    { body: 'Reviewed', version: 1 },
    randomUUID(),
  )
  const writer = new Client({ connectionString: databaseUrl })
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
      // Commit between the page and count SELECTs, keeping the real database reads.
      if (!inserted && Array.isArray(result) && result.length === 0) {
        inserted = true
        await writer.query(
          'insert into feedback_notification (user_id, response_id) values ($1, $2)',
          [author.user.id, response.id],
        )
      }
      return result
    },
  )
  try {
    assert.deepEqual(await listNotifications(author.user.id, { unread: true }), {
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
    })
    assert.ok(inserted)
    const refreshed = await listNotifications(author.user.id, { unread: true })
    assert.equal(refreshed.notifications.length, 1)
    assert.equal(refreshed.unreadCount, 1)
  } finally {
    await writer.end()
  }
})
