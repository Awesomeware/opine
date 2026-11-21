import { NodePgPreparedQuery } from 'drizzle-orm/node-postgres/session'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, afterEach, test } from 'node:test'
import { Client } from 'pg'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../tests/fixtures.ts'
import { getOutcome } from '../review/outcome.ts'
import { publishResponse } from '../review/publication.ts'
import {
  feedbackCategory,
  feedbackCategoryChange,
  feedbackComment,
  feedbackFollow,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
  feedbackWriteReceipt,
} from '../schema.ts'
import { setFollowing } from '../subscriptions/following.ts'
import { listNotifications, markNotificationRead } from '../subscriptions/inbox.ts'
import { FeedbackWriteError } from '../writes.ts'

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
