import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { eventLog } from '../../../server/events/schema.ts'
import { feedbackComment, feedbackPost } from '../server/schema.ts'
import {
  persistenceContent as content,
  readPersistenceFixture,
  cleanPersistenceFixture,
} from './persistence-fixture.ts'

test.afterAll(closeDatabase)

test('content, sessions, cooldown, outcomes, tags, inbox, and moderation survive restart', async ({
  page,
  request,
}) => {
  const saved = await readPersistenceFixture()

  const base = `/api/feedback/posts/${saved.postId}`

  const headers = (cookie: typeof saved.authorCookie) => ({
    cookie: `${cookie.name}=${cookie.value}`,
  })
  try {
    await page.goto(
      `/feedback/${saved.postId}?comment=${saved.commentId}#comment-${saved.commentId}`,
    )
    await expect(page.getByRole('heading', { name: content.title })).toBeVisible()
    await expect(page.locator(`#comment-${saved.commentId}`)).toContainText(content.editedComment)
    await expect(page.locator(`#comment-${saved.commentId}`)).toContainText('Edited')
    await expect(page.getByText(content.tagName, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Sign in with Discord', exact: true }),
    ).toBeVisible()

    const postResponse = await request.get(base)
    expect(postResponse.status()).toBe(200)
    const post = (await postResponse.json()).post
    expect(post.version).toBe(2)
    expect(post.editedAt).toBeTruthy()
    expect(post.tags.map((tag: { id: string }) => tag.id)).toEqual([saved.tagId])

    const limited = await request.post('/api/feedback/posts', {
      headers: { ...headers(saved.authorCookie), origin: process.env.BETTER_AUTH_URL! },
      data: {
        title: 'Another proposal too soon',
        description: content.description,
      },
    })
    expect(limited.status()).toBe(429)
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)

    const comments = await getDatabase()
      .select()
      .from(feedbackComment)
      .where(eq(feedbackComment.postId, saved.postId))
    expect(comments).toHaveLength(1)
    expect(comments[0]).toMatchObject({ body: content.editedComment, type: 'context', version: 2 })

    await page.context().addCookies([saved.authorCookie])
    await page.reload()
    await expect(page.getByText('Signed in as Persistence author')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()

    const outcome = await (
      await request.get(`${base}/outcome`, { headers: headers(saved.authorCookie) })
    ).json()
    expect(outcome).toMatchObject({
      version: 3,
      following: true,
      latestResponse: { id: saved.latestResponseId },
      statusResponse: { id: saved.statusResponseId },
    })
    await page.goto(
      `/feedback/${saved.postId}?contribution=question&response=${saved.statusResponseId}#response-${saved.statusResponseId}`,
    )
    await expect(page.locator(`#response-${saved.statusResponseId}`)).toContainText(
      content.statusResponse,
    )
    const panel = page.getByRole('region', { name: 'Feedback overview' })
    await expect(panel).toContainText('Reviewing')
    await expect(panel).toContainText(content.latestResponse)

    const authorInbox = await (
      await request.get('/api/feedback/notifications', { headers: headers(saved.authorCookie) })
    ).json()
    expect(authorInbox.unreadCount).toBe(2)

    await page.context().addCookies([saved.followerCookie])
    await page.reload()
    await expect(page.getByRole('button', { name: 'Follow updates', exact: true })).toBeVisible()

    const followerInbox = await (
      await request.get('/api/feedback/notifications', { headers: headers(saved.followerCookie) })
    ).json()
    expect(followerInbox.unreadCount).toBe(0)
    expect(followerInbox.notifications).toHaveLength(1)
    expect(followerInbox.notifications[0].id).toBe(saved.notificationId)
    expect(followerInbox.notifications[0].readAt).toBeTruthy()

    const lockedBase = `/api/feedback/posts/${saved.lockedPostId}`
    const lockedResponse = await request.get(lockedBase)
    expect(lockedResponse.status()).toBe(200)
    expect((await lockedResponse.json()).post.lockedAt).toBe(saved.lockedAt)
    const lockedWrite = await request.post(`${lockedBase}/comments`, {
      headers: { ...headers(saved.followerCookie), origin: process.env.BETTER_AUTH_URL! },
      data: { body: 'Must remain blocked after restart.', type: 'context' },
    })
    expect(lockedWrite.status()).toBe(423)
    await page.goto(`/feedback/${saved.lockedPostId}`)
    await expect(
      page.getByText('Locked · Contributions and changes are paused.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toHaveCount(0)

    expect((await request.get(`/api/feedback/posts/${saved.archivedPostId}`)).status()).toBe(404)
    await page.goto(`/feedback/${saved.archivedPostId}`)
    await expect(page.getByRole('heading', { name: 'Feedback not found' })).toBeVisible()
    const [archived] = await getDatabase()
      .select()
      .from(feedbackPost)
      .where(eq(feedbackPost.id, saved.archivedPostId))
    expect(archived?.archivedAt?.toISOString()).toBe(saved.archivedAt)
    expect(archived?.description).toBe(content.description)

    const events = await getDatabase()
      .select({ id: eventLog.id, eventType: eventLog.eventType, details: eventLog.details })
      .from(eventLog)
      .where(
        inArray(
          eventLog.id,
          saved.moderationEvents.map((event) => event.id),
        ),
      )
    expect(events).toHaveLength(2)
    expect(events).toEqual(expect.arrayContaining(saved.moderationEvents))
  } finally {
    await cleanPersistenceFixture(saved)
  }
})
