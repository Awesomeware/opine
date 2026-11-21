import { eq, sql } from 'drizzle-orm'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { Client } from 'pg'
import { eventLog } from '../../../../server/events/schema.ts'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import {
  applyMigrations,
  withMigrationDatabase,
} from '../../../../tests/helpers/migration-database.ts'
import { setUserRole } from '../../../auth/server/roles.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../tests/fixtures.ts'
import { createComment, editComment, getComment, listComments } from '../discussion/comments.ts'
import { getReactions, setReaction } from '../discussion/reactions.ts'
import { getPost, listPosts } from '../posts/queries.ts'
import { listNotifications, markNotificationRead } from '../subscriptions/inbox.ts'
import { archivePost, setPostLocked } from './moderation.ts'
import { listDiscussion } from '../discussion/feed.ts'
import { editPost } from '../posts/editing.ts'
import {
  feedbackCategory,
  feedbackCategoryChange,
  feedbackComment,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
} from '../schema.ts'
import { setFollowing } from '../subscriptions/following.ts'
import { FeedbackWriteError } from '../writes.ts'
import { correctCategory, listCategoryHistory } from './category-correction.ts'
import { getOfficialResponse, getOutcome } from './outcome.ts'
import { publishResponse } from './publication.ts'
import { listReviewQueue } from './queue.ts'

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
  await database.delete(feedbackPost)
  await database.delete(feedbackCategory)
  await database.delete(eventLog)
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
    await applyMigrations(isolated, 4, 5)
    const afterPost = (await isolated.query('select * from feedback_post')).rows[0]
    for (const [key, value] of Object.entries(beforePost)) assert.deepEqual(afterPost[key], value)
    assert.equal(afterPost.workflow_version, 1)
    for (const [index, table] of preserved.entries())
      assert.deepEqual((await isolated.query(`select * from ${table}`)).rows, before[index])
  })
})

test('official publication atomically changes status and notifies each follower once while concurrent stale publications conflict', async () => {
  const { author, manager, post } = await discussion()
  await setFollowing(author.user.id, post.id, true)
  await setFollowing(manager.user.id, post.id, true)
  const input = {
    body: 'We are reviewing this feedback.',
    status: 'reviewing' as const,
    version: 1,
  }
  const attempts = await Promise.allSettled(
    Array.from({ length: 4 }, () => publishResponse(manager.user.id, post.id, input)),
  )
  const results = attempts
    .filter((attempt) => attempt.status === 'fulfilled')
    .map((attempt) => attempt.value)
  assert.equal(results.length, 1)
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected')
  assert.equal(rejected.length, 3)
  for (const attempt of rejected) assert.ok(status(409)(attempt.reason))
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
    publishResponse(manager.user.id, post.id, { ...input, body: 'Changed' }),
    status(409),
  )
  await setUserRole(manager.user.id, 'community-manager', false, null)
  assert.equal((await getOutcome(post.id, manager.user.id))?.canRespond, false)
  const publicResponse = await getOfficialResponse(post.id, results[0]!.id)
  assert.deepEqual(publicResponse?.author, { name: 'Community manager' })
  for (const privateValue of [manager.user.email, manager.user.id, manager.session.token])
    assert.ok(!JSON.stringify(publicResponse).includes(privateValue))
  assert.equal(await getOfficialResponse(randomUUID(), results[0]!.id), undefined)
})

test('official response limits count existing rows and expire', async () => {
  const { manager, post } = await discussion()
  const maximum = Number(process.env.FEEDBACK_RESPONSE_MAX ?? 20)
  await getDatabase()
    .insert(feedbackOfficialResponse)
    .values(
      Array.from({ length: maximum }, () => ({
        postId: post.id,
        authorId: manager.user.id,
        body: 'Existing response',
      })),
    )
  const input = { body: 'Another response', version: 1 }
  await assert.rejects(publishResponse(manager.user.id, post.id, input), status(429))
  await getDatabase()
    .update(feedbackOfficialResponse)
    .set({ createdAt: new Date(Date.now() - 61_000) })
  assert.ok(await publishResponse(manager.user.id, post.id, input))
})

test('notification failure rolls back response and status so publication can be attempted again', async () => {
  const { author, manager, post } = await discussion()
  await setFollowing(author.user.id, post.id, true)
  const database = getDatabase()
  const input = { body: 'This is now planned.', status: 'planned' as const, version: 1 }
  await database.execute(
    sql`create function reject_test_notification() returns trigger language plpgsql as $$ begin raise exception 'Simulated notification failure'; end $$`,
  )
  try {
    await database.execute(
      sql`create trigger reject_test_notification before insert on feedback_notification for each row execute function reject_test_notification()`,
    )
    try {
      await assert.rejects(publishResponse(manager.user.id, post.id, input))
      assert.equal((await database.select().from(feedbackOfficialResponse)).length, 0)
      assert.equal((await database.select().from(feedbackNotification)).length, 0)
      const outcome = await getOutcome(post.id)
      assert.equal(outcome?.status, 'new')
      assert.equal(outcome?.version, 1)
    } finally {
      await database.execute(sql`drop trigger reject_test_notification on feedback_notification`)
    }
  } finally {
    await database.execute(sql`drop function reject_test_notification()`)
  }
  await publishResponse(manager.user.id, post.id, input)
  assert.equal((await database.select().from(feedbackNotification)).length, 1)
})

test('workflow conflicts serialize managers while author edits and later responses preserve the current explanation', async () => {
  const { author, manager, post } = await discussion()
  const other = await createMember({ roles: ['community-manager'] })
  // Both representatives follow: publishing must not deadlock on each other's recipient rows.
  await setFollowing(manager.user.id, post.id, true)
  await setFollowing(other.user.id, post.id, true)
  const results = await Promise.allSettled(
    [manager, other].map((actor) =>
      publishResponse(actor.user.id, post.id, {
        body: 'We acknowledge the issue.',
        status: 'reviewing',
        version: 1,
      }),
    ),
  )
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = results.find((result) => result.status === 'rejected')
  assert.ok(rejected && status(409)(rejected.reason))
  const acknowledged = await getOutcome(post.id)
  assert.equal(acknowledged?.version, 2)
  const edited = await editPost(author.user.id, post.id, {
    title: 'Clarified original feedback',
    description: post.description,
    desiredImprovement: null,
    version: 1,
  })
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
  const later = await publishResponse(manager.user.id, post.id, {
    body: 'Here is an additional detail.',
    version: 2,
  })
  const current = await getOutcome(post.id)
  assert.equal(current?.version, 3)
  assert.equal(current?.status, 'reviewing')
  assert.equal(current?.latestResponse?.id, later.id)
  assert.ok(current.latestResponse.createdAt.getTime() > priorCommentTime.getTime())
  assert.equal((await listReviewQueue({ status: 'all', followUp: true })).posts.length, 0)
  assert.equal(current?.latestResponse?.status, null)
  assert.equal(current?.statusResponse?.id, acknowledged?.statusResponse?.id)
  await createComment(author.user.id, post.id, {
    body: 'Thank you for reviewing.',
    type: 'context',
  })
  assert.equal((await listReviewQueue({ status: 'all', followUp: true })).posts.length, 1)
  assert.equal((await getDatabase().select().from(feedbackNotification)).length, 4)
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
  const initial = await listReviewQueue({ limit: 1 })
  assert.deepEqual(
    initial.posts.map((row) => row.id),
    [oldest.id],
  )
  assert.ok(initial.nextCursor)
  const following = await listReviewQueue({
    limit: 1,
    cursor: cursor(initial.nextCursor),
  })
  assert.deepEqual(
    following.posts.map((row) => row.id),
    [second.id],
  )
  assert.deepEqual(
    (await listReviewQueue({ category: otherCategory.slug })).posts.map((row) => row.id),
    [second.id],
  )
  await publishResponse(manager.user.id, oldest.id, {
    body: 'Under review',
    status: 'reviewing',
    version: 1,
  })
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
  assert.equal((await listReviewQueue({ followUp: true, status: 'all' })).posts.length, 0)
  await database.insert(feedbackComment).values({
    postId: oldest.id,
    authorId: author.user.id,
    body: 'Member follow-up',
    type: 'question',
    createdAt: new Date('2022-01-01'),
  })
  assert.deepEqual(
    (await listReviewQueue({ followUp: true, status: 'all' })).posts.map((row) => row.id),
    [oldest.id],
  )
  assert.deepEqual(
    (await listReviewQueue({ status: 'reviewing' })).posts.map((row) => row.id),
    [oldest.id],
  )
  await publishResponse(manager.user.id, oldest.id, { body: 'Answer to follow-up', version: 2 })
  assert.equal((await listReviewQueue({ followUp: true, status: 'all' })).posts.length, 0)
})

test('category corrections are conflict-safe, audited once, and independent of author text edits', async () => {
  const { manager, category, post } = await discussion()
  const target = await createCategory()
  const input = { categoryId: target.id, version: 1 }
  const unchanged = { categoryId: category.id, version: 1 }
  assert.deepEqual(await correctCategory(manager.user.id, post.id, unchanged), {
    id: post.id,
    version: 1,
  })
  const result = await correctCategory(manager.user.id, post.id, input)
  assert.equal(result.version, 2)
  await assert.rejects(correctCategory(manager.user.id, post.id, input), status(409))
  await assert.rejects(correctCategory(manager.user.id, post.id, unchanged), status(409))
  const audit = await getDatabase().select().from(feedbackCategoryChange)
  assert.equal(audit.length, 1)
  assert.equal(audit[0]!.previousCategoryId, category.id)
  assert.equal(audit[0]!.categoryId, target.id)
  assert.equal(audit[0]!.actorId, manager.user.id)
  assert.equal((await getDatabase().select().from(feedbackPost))[0]!.version, 1)
  await assert.rejects(
    correctCategory(manager.user.id, post.id, { categoryId: category.id, version: 1 }),
    status(409),
  )
  assert.equal((await listCategoryHistory(post.id)).changes.length, 1)
  const inactive = await createCategory({ isActive: false })
  await assert.rejects(
    correctCategory(manager.user.id, post.id, { categoryId: inactive.id, version: 2 }),
    status(400),
  )
  assert.equal((await getDatabase().select().from(feedbackNotification)).length, 0)
})

test('category history pages chronologically across timestamp ties without leaking another post', async () => {
  const { manager, category, post } = await discussion()
  const target = await createCategory({ name: 'Corrected category' })
  const other = await createFeedbackPost({ authorId: manager.user.id, categoryId: category.id })
  const ids = [1, 2, 3, 4, 5].map((id) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`)
  const times = [1, 1, 0, 2, 1]
  await getDatabase()
    .insert(feedbackCategoryChange)
    .values(
      ids.map((id, index) => ({
        id,
        postId: index === 4 ? other.id : post.id,
        actorId: manager.user.id,
        previousCategoryId: category.id,
        categoryId: target.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, times[index])),
      })),
    )

  const first = await listCategoryHistory(post.id, { limit: 2 })
  assert.deepEqual(
    first.changes.map((change) => change.id),
    [ids[2], ids[0]],
  )
  assert.ok(first.nextCursor)
  const second = await listCategoryHistory(post.id, { limit: 2, cursor: cursor(first.nextCursor) })
  assert.deepEqual(
    second.changes.map((change) => change.id),
    [ids[1], ids[3]],
  )
  assert.equal(second.nextCursor, null)
  assert.deepEqual(
    (await listCategoryHistory(other.id)).changes.map((change) => change.id),
    [ids[4]],
  )
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
    // Prime the statistics cache before the reader starts, exercising refresh on polling.
    await writer.query('select pid from pg_stat_activity')
    pending = listDiscussion(post.id, { limit: 1 })
    const deadline = Date.now() + 4000
    while (true) {
      // Activity is cached for this transaction, even as other sessions advance.
      await writer.query('select pg_stat_clear_snapshot()')
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

test('locking makes contributions read-only, preserves following, and logs only state changes', async () => {
  const { author, manager, post } = await discussion()
  const comment = await createComment(author.user.id, post.id, {
    body: 'A useful suggestion.',
    type: 'suggestion',
  })
  const locked = await setPostLocked(manager.user.id, post.id, true)
  assert.ok(locked.lockedAt)
  assert.deepEqual(await setPostLocked(manager.user.id, post.id, true), locked)
  assert.equal((await getPost(post.id, author.user.id))?.canEdit, false)
  assert.equal((await getComment(post.id, comment.id, author.user.id))?.canEdit, false)
  const outcome = await getOutcome(post.id, manager.user.id)
  assert.equal(outcome.canModerate, true)
  assert.equal(outcome.canRespond, false)

  await assert.rejects(
    editPost(author.user.id, post.id, {
      title: post.title,
      description: post.description,
      desiredImprovement: null,
      version: 1,
    }),
    status(423),
  )
  await assert.rejects(
    createComment(author.user.id, post.id, { body: 'Another idea.', type: 'suggestion' }),
    status(423),
  )
  await assert.rejects(
    editComment(author.user.id, post.id, comment.id, {
      body: 'Changed idea.',
      type: 'suggestion',
      version: 1,
    }),
    status(423),
  )
  await assert.rejects(setReaction(author.user.id, post.id, 'agree'), status(423))
  await assert.rejects(
    publishResponse(manager.user.id, post.id, { body: 'Official answer.', version: 1 }),
    status(423),
  )
  await assert.rejects(
    correctCategory(manager.user.id, post.id, { categoryId: post.categoryId, version: 1 }),
    status(423),
  )
  await setFollowing(author.user.id, post.id, true)
  await setFollowing(author.user.id, post.id, true)
  await setFollowing(author.user.id, post.id, false)
  await setFollowing(author.user.id, post.id, false)
  await setPostLocked(manager.user.id, post.id, false)
  assert.equal((await getPost(post.id, author.user.id))?.canEdit, true)
  await setReaction(author.user.id, post.id, 'agree')
  await setReaction(author.user.id, post.id, 'agree')
  await setReaction(author.user.id, post.id, null)
  const events = await getDatabase().select().from(eventLog)
  assert.equal(events.filter((event) => event.eventType === 'post.locked').length, 1)
  assert.equal(events.filter((event) => event.eventType === 'post.unlocked').length, 1)
  assert.equal(events.filter((event) => event.eventType === 'post.followed').length, 1)
  assert.equal(events.filter((event) => event.eventType === 'post.unfollowed').length, 1)
  assert.equal(events.filter((event) => event.eventType === 'reaction.changed').length, 2)
  assert.equal(events.filter((event) => event.eventType === 'comment.created').length, 1)
})

test('archiving hides every post projection and notification without deleting retained content', async () => {
  const { author, manager, post } = await discussion()
  await setFollowing(author.user.id, post.id, true)
  const comment = await createComment(author.user.id, post.id, {
    body: 'A useful suggestion.',
    type: 'suggestion',
  })
  const response = await publishResponse(manager.user.id, post.id, {
    body: 'Official answer.',
    version: 1,
  })
  const inbox = await listNotifications(author.user.id)
  assert.equal(inbox.unreadCount, 1)
  const notification = inbox.notifications[0]!
  await archivePost(manager.user.id, post.id)

  assert.equal(await getPost(post.id, manager.user.id), undefined)
  assert.equal((await listPosts()).posts.length, 0)
  assert.equal((await listReviewQueue({ status: 'all' })).posts.length, 0)
  assert.equal(await getComment(post.id, comment.id), undefined)
  assert.equal(await getOfficialResponse(post.id, response.id), undefined)
  await assert.rejects(listComments(post.id), status(404))
  await assert.rejects(listDiscussion(post.id), status(404))
  await assert.rejects(listDiscussion(post.id, { type: 'team' }), status(404))
  await assert.rejects(getOutcome(post.id, manager.user.id), status(404))
  await assert.rejects(getReactions(post.id), status(404))
  await assert.rejects(listCategoryHistory(post.id), status(404))
  assert.deepEqual(await listNotifications(author.user.id), {
    notifications: [],
    nextCursor: null,
    unreadCount: 0,
  })
  await assert.rejects(markNotificationRead(author.user.id, notification.id), status(404))
  await assert.rejects(setFollowing(author.user.id, post.id, true), status(404))
  await assert.rejects(setReaction(author.user.id, post.id, 'agree'), status(404))
  await assert.rejects(setPostLocked(manager.user.id, post.id, false), status(404))
  await assert.rejects(archivePost(manager.user.id, post.id), status(404))
  await assert.rejects(
    createComment(author.user.id, post.id, { body: 'Another idea.', type: 'suggestion' }),
    status(404),
  )
  await assert.rejects(
    editComment(author.user.id, post.id, comment.id, {
      body: 'Edited idea.',
      type: 'suggestion',
      version: 1,
    }),
    status(404),
  )
  await assert.rejects(
    editPost(author.user.id, post.id, {
      title: post.title,
      description: post.description,
      desiredImprovement: null,
      version: 1,
    }),
    status(404),
  )
  await assert.rejects(
    publishResponse(manager.user.id, post.id, { body: 'Another answer.', version: 2 }),
    status(404),
  )
  await assert.rejects(
    correctCategory(manager.user.id, post.id, { categoryId: post.categoryId, version: 2 }),
    status(404),
  )
  assert.equal((await getDatabase().select().from(feedbackPost)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackComment)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackOfficialResponse)).length, 1)
  assert.equal((await getDatabase().select().from(feedbackNotification)).length, 1)
  const events = await getDatabase()
    .select()
    .from(eventLog)
    .where(eq(eventLog.eventType, 'post.archived'))
  assert.equal(events.length, 1)
  assert.equal(events[0]!.actorId, manager.user.id)
  assert.deepEqual(events[0]!.details, { postId: post.id })
})

test('a failed event insert rolls back moderation and its timestamp', async () => {
  const { manager, post } = await discussion()
  const database = getDatabase()
  await database.execute(
    sql`create function reject_test_event() returns trigger language plpgsql as $$ begin raise exception 'Simulated event failure'; end $$`,
  )
  try {
    await database.execute(
      sql`create trigger reject_test_event before insert on event_log for each row execute function reject_test_event()`,
    )
    try {
      await assert.rejects(setPostLocked(manager.user.id, post.id, true))
      await assert.rejects(archivePost(manager.user.id, post.id))
      const [stored] = await database
        .select()
        .from(feedbackPost)
        .where(eq(feedbackPost.id, post.id))
      assert.equal(stored!.lockedAt, null)
      assert.equal(stored!.archivedAt, null)
    } finally {
      await database.execute(sql`drop trigger reject_test_event on event_log`)
    }
  } finally {
    await database.execute(sql`drop function reject_test_event()`)
  }
})

test('a contribution waiting on moderation observes the committed lock or archive', async () => {
  const { author, post } = await discussion()
  const blocker = new Client({ connectionString: databaseUrl })
  await blocker.connect()
  try {
    for (const state of ['locked', 'archived'] as const) {
      await blocker.query('begin')
      const { rows } = await blocker.query('select pg_backend_pid() as pid')
      await blocker.query('select id from feedback_post where id = $1 for no key update', [post.id])
      const pending = createComment(author.user.id, post.id, {
        body: 'A concurrent suggestion.',
        type: 'suggestion',
      })
      // Attach the rejection handler before releasing the blocked request.
      const rejected = assert.rejects(pending, status(state === 'locked' ? 423 : 404))
      try {
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
        assert.ok(waiting, 'Comment must wait for the moderation transaction')
        if (state === 'locked') {
          await blocker.query('update feedback_post set locked_at = now() where id = $1', [post.id])
        } else {
          await blocker.query('update feedback_post set archived_at = now() where id = $1', [
            post.id,
          ])
        }
        await blocker.query('commit')
        await rejected
      } finally {
        await blocker.query('rollback')
        await rejected
      }
    }
    assert.equal((await getDatabase().select().from(feedbackComment)).length, 0)
    assert.equal((await getDatabase().select().from(eventLog)).length, 0)
  } finally {
    await blocker.end()
  }
})
