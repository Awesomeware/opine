import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
} from '../server/schema.ts'

test.afterAll(closeDatabase)

test('official responses, status explanations, follows, and read notifications survive restart', async ({
  page,
  request,
}) => {
  if (process.env.OPINE_TEST_PHASE !== 'restart' || !process.env.OPINE_TEST_ARTIFACT_DIR)
    throw new Error('Run through the isolated E2E restart phase.')
  const saved: {
    postId: string
    categoryId: string
    userIds: string[]
    authorCookie: { name: string; value: string; url: string }
    followerCookie: { name: string; value: string; url: string }
    firstResponseId: string
    latestResponseId: string
    notificationId: string
  } = JSON.parse(await readFile(join(process.env.OPINE_TEST_ARTIFACT_DIR, 'outcomes.json'), 'utf8'))
  const base = `/api/feedback/posts/${saved.postId}`
  try {
    await page.goto(
      `/feedback/${saved.postId}?contribution=question&response=${saved.firstResponseId}#response-${saved.firstResponseId}`,
    )
    const panel = page.getByRole('region', { name: 'Feedback overview' })
    await expect(panel).toContainText('Reviewing')
    await expect(panel).toContainText('We are collecting examples')
    await expect(page.locator(`#response-${saved.firstResponseId}`)).toContainText(
      'We acknowledge the issue',
    )
    const outcome = await (await request.get(`${base}/outcome`)).json()
    expect(outcome.version).toBe(3)
    expect(outcome.latestResponse.id).toBe(saved.latestResponseId)
    expect(outcome.statusResponse.id).toBe(saved.firstResponseId)
    const authorHeaders = { cookie: `${saved.authorCookie.name}=${saved.authorCookie.value}` }
    expect(
      (await (await request.get(`${base}/outcome`, { headers: authorHeaders })).json()).following,
    ).toBe(true)
    const authorInbox = await (
      await request.get('/api/feedback/notifications', { headers: authorHeaders })
    ).json()
    expect(authorInbox.unreadCount).toBe(2)
    await page.context().addCookies([saved.followerCookie])
    await page.reload()
    await expect(page.getByRole('button', { name: 'Follow updates', exact: true })).toBeVisible()
    const followerInbox = await (
      await request.get('/api/feedback/notifications', {
        headers: { cookie: `${saved.followerCookie.name}=${saved.followerCookie.value}` },
      })
    ).json()
    expect(followerInbox.unreadCount).toBe(0)
    expect(followerInbox.notifications).toHaveLength(1)
    expect(followerInbox.notifications[0].id).toBe(saved.notificationId)
    expect(followerInbox.notifications[0].readAt).toBeTruthy()
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, saved.postId))
    await getDatabase()
      .delete(feedbackOfficialResponse)
      .where(eq(feedbackOfficialResponse.postId, saved.postId))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, saved.postId))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, saved.categoryId))
    await getDatabase().delete(user).where(inArray(user.id, saved.userIds))
  }
})
