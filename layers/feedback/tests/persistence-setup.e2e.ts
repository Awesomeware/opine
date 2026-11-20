import { randomUUID } from 'node:crypto'
import { expect, test, type APIResponse } from '@playwright/test'
import { closeDatabase } from '../../../server/db/index.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import { createCategory } from './fixtures.ts'
import { persistenceContent as content, savePersistenceFixture } from './persistence-fixture.ts'

test.afterAll(closeDatabase)

test('prepare explicit persistence state before database and application restart', async ({
  request,
}) => {
  const author = await createMember({ name: 'Persistence author' })
  const follower = await createMember({ name: 'Persistence follower' })
  const manager = await createMember({ roles: ['administrator', 'community-manager'] })
  const category = await createCategory()

  const headers = (cookie = author.cookieHeader, key = randomUUID()) => ({
    origin: process.env.BETTER_AUTH_URL!,
    cookie,
    'Idempotency-Key': key,
  })

  async function result(response: APIResponse, status = 200) {
    expect(response.status()).toBe(status)
    return response.json()
  }

  // This is the only scenario that deliberately survives the main test phase.
  // Every persisted mutation goes through HTTP so receipts and notifications are real.
  const tag = await result(
    await request.post('/api/feedback/tags', {
      headers: headers(manager.cookieHeader),
      data: { name: content.tagName },
    }),
    201,
  )

  const post = await result(
    await request.post('/api/feedback/posts', {
      headers: headers(),
      data: {
        title: 'Initial proposal',
        description: content.description,
        categoryId: category.id,
        tagIds: [tag.id],
      },
    }),
    201,
  )

  const base = `/api/feedback/posts/${post.id}`
  await result(
    await request.patch(base, {
      headers: headers(),
      data: {
        title: content.title,
        description: content.description,
        desiredImprovement: null,
        tagIds: [tag.id],
        version: 1,
      },
    }),
  )

  const commentRequestKey = randomUUID()
  const comment = await result(
    await request.post(`${base}/comments`, {
      headers: headers(author.cookieHeader, commentRequestKey),
      data: { body: content.comment, type: 'context' },
    }),
    201,
  )
  await result(
    await request.patch(`${base}/comments/${comment.id}`, {
      headers: headers(),
      data: { body: content.editedComment, type: 'context', version: 1 },
    }),
  )
  await result(
    await request.put(`${base}/reactions`, { headers: headers(), data: { kind: 'agree' } }),
  )
  await result(
    await request.put(`${base}/follow`, {
      headers: headers(follower.cookieHeader),
      data: { following: true },
    }),
  )

  const first = await result(
    await request.post(`${base}/responses`, {
      headers: headers(manager.cookieHeader),
      data: { body: content.statusResponse, status: 'reviewing', version: 1 },
    }),
    201,
  )

  const inbox = await result(
    await request.get('/api/feedback/notifications', { headers: headers(follower.cookieHeader) }),
  )
  expect(inbox.notifications).toHaveLength(1)
  const notificationId = inbox.notifications[0].id
  await result(
    await request.patch(`/api/feedback/notifications/${notificationId}`, {
      headers: headers(follower.cookieHeader),
      data: { read: true },
    }),
  )
  await result(
    await request.put(`${base}/follow`, {
      headers: headers(follower.cookieHeader),
      data: { following: false },
    }),
  )

  const second = await result(
    await request.post(`${base}/responses`, {
      headers: headers(manager.cookieHeader),
      data: { body: content.latestResponse, version: 2 },
    }),
    201,
  )

  await savePersistenceFixture({
    postId: post.id,
    categoryId: category.id,
    tagId: tag.id,
    userIds: [author.user.id, follower.user.id, manager.user.id],
    authorCookie: author.cookie,
    followerCookie: follower.cookie,
    commentId: comment.id,
    commentRequestKey,
    statusResponseId: first.id,
    latestResponseId: second.id,
    notificationId,
  })
})
