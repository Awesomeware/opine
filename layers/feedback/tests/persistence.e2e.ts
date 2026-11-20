import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { feedbackComment } from '../server/schema.ts'
import {
  persistenceContent as content,
  readPersistenceFixture,
  cleanPersistenceFixture,
} from './persistence-fixture.ts'

test.afterAll(closeDatabase)

test('content, sessions, receipts, official outcomes, tags, and inbox state survive restart', async ({
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

    const retry = await request.post(`${base}/comments`, {
      headers: {
        ...headers(saved.authorCookie),
        origin: process.env.BETTER_AUTH_URL!,
        'Idempotency-Key': saved.commentRequestKey,
      },
      data: { body: content.comment, type: 'context' },
    })
    expect(retry.status()).toBe(201)
    expect((await retry.json()).id).toBe(saved.commentId)

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
  } finally {
    await cleanPersistenceFixture(saved)
  }
})
