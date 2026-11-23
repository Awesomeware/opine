import { eq } from 'drizzle-orm'
import { NodePgPreparedQuery } from 'drizzle-orm/node-postgres/session'
import assert from 'node:assert/strict'
import { after, afterEach, test } from 'node:test'
import { Client } from 'pg'
import { eventLog } from '../../../../server/events/schema.ts'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { createFeedbackPost } from '../../tests/fixtures.ts'
import { getOutcome } from '../review/outcome.ts'
import { publishResponse } from '../review/publication.ts'
import {
  feedbackComment,
  feedbackFollow,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
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
  await database.delete(feedbackComment)
  await database.delete(feedbackPost)
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
  const post = await createFeedbackPost({ authorId: author.user.id })
  return { author, manager, post }
}

test('following accepts repeated assignments, inboxes stay private, and unfollowing preserves received notifications', async () => {
  const { author, manager, post } = await discussion()
  const outsider = await createMember()
  await Promise.all(Array.from({ length: 3 }, () => setFollowing(author.user.id, post.id, true)))
  assert.equal((await getDatabase().select().from(feedbackFollow)).length, 1)
  await setFollowing(author.user.id, post.id, true)
  const response = await publishResponse(manager.user.id, post.id, {
    body: 'First response',
    version: 1,
  })
  const secondResponse = await publishResponse(manager.user.id, post.id, {
    body: 'Second response',
    version: 2,
  })
  const thirdResponse = await publishResponse(manager.user.id, post.id, {
    body: 'Third response',
    version: 3,
  })
  const notificationIds = [1, 2, 3].map(
    (id) => `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
  )
  // Fix both sort keys: later responses tie on time, so UUID descending breaks the tie.
  for (const [index, publication] of [response, secondResponse, thirdResponse].entries()) {
    await getDatabase()
      .update(feedbackNotification)
      .set({
        id: notificationIds[index],
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index === 0 ? 0 : 1)),
      })
      .where(eq(feedbackNotification.responseId, publication.id))
  }
  const first = await listNotifications(author.user.id, { limit: 1 })
  assert.equal(first.notifications.length, 1)
  assert.equal(first.unreadCount, 3)
  assert.ok(first.nextCursor)
  const second = await listNotifications(author.user.id, {
    limit: 1,
    cursor: cursor(first.nextCursor),
  })
  assert.equal(second.notifications.length, 1)
  assert.ok(second.nextCursor)
  const third = await listNotifications(author.user.id, {
    limit: 1,
    cursor: cursor(second.nextCursor),
  })
  assert.deepEqual(
    [...first.notifications, ...second.notifications, ...third.notifications].map((row) => row.id),
    [notificationIds[2], notificationIds[1], notificationIds[0]],
  )
  assert.equal(third.notifications[0]!.responseId, response.id)
  assert.equal(third.nextCursor, null)
  assert.equal((await listNotifications(outsider.user.id)).notifications.length, 0)
  const notificationId = first.notifications[0]!.id
  await assert.rejects(markNotificationRead(outsider.user.id, notificationId), status(404))
  await markNotificationRead(author.user.id, notificationId)
  await markNotificationRead(author.user.id, notificationId)
  const unread = await listNotifications(author.user.id, { unread: true })
  assert.equal(unread.unreadCount, 2)
  assert.equal(unread.notifications.length, 2)
  await setFollowing(author.user.id, post.id, false)
  await publishResponse(manager.user.id, post.id, {
    body: 'Fourth response after unfollow',
    version: 4,
  })
  assert.equal((await listNotifications(author.user.id)).notifications.length, 3)
  assert.equal((await getOutcome(post.id, author.user.id))?.following, false)
})

test('inbox rows and unread count share one snapshot during notification delivery', async (t) => {
  const { author, manager, post } = await discussion()
  const response = await publishResponse(manager.user.id, post.id, { body: 'Reviewed', version: 1 })
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
