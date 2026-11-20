import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
} from '../server/schema.ts'
import { createCategory, createFeedbackPost } from './fixtures.ts'

test.afterAll(closeDatabase)
const headers = (cookie: string, key = randomUUID()) => ({
  origin: process.env.BETTER_AUTH_URL!,
  cookie,
  'Idempotency-Key': key,
})

test('a typed contribution receives an official outcome and followers can read its notification', async ({
  page,
  request,
}, testInfo) => {
  const author = await createMember({ name: 'Proposal author' })
  const follower = await createMember({ name: 'Interested player' })
  const cm = await createMember({ name: 'Community representative', roles: ['community-manager'] })
  const category = await createCategory()
  let postId: string | undefined
  try {
    const created = await request.post('/api/feedback/posts', {
      headers: headers(author.cookieHeader),
      data: {
        title: 'Make group invitations clearer',
        description: 'The invitation is too easy to miss.',
        categoryId: category.id,
      },
    })
    expect(created.status()).toBe(201)
    postId = (await created.json()).id
    const base = `/api/feedback/posts/${postId}`
    await page.context().addCookies([follower.cookie])
    await page.goto(`/feedback/${postId}`)
    const outcome = page.getByRole('region', { name: 'Feedback overview' })
    await expect(outcome).toContainText('Awaiting initial review')
    await page.getByRole('button', { name: 'Follow updates', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Unfollow updates', exact: true })).toBeVisible()
    await page.getByRole('radio', { name: 'Question', exact: true }).check()
    await page
      .getByLabel('Add a comment', { exact: true })
      .fill('Could invitations remain visible for longer?')
    await page.getByRole('button', { name: 'Submit comment', exact: true }).click()
    await page.waitForURL(/comment=/)
    const commentId = new URL(page.url()).searchParams.get('comment')!
    expect(
      (
        await (
          await request.get('/api/feedback/notifications', {
            headers: { cookie: follower.cookieHeader },
          })
        ).json()
      ).unreadCount,
    ).toBe(0)
    const ordinary = await request.post(`${base}/comments`, {
      headers: headers(cm.cookieHeader),
      data: { body: 'I have also noticed this when playing.', type: 'context' },
    })
    expect(ordinary.status()).toBe(201)
    expect((await (await request.get(`${base}/outcome`)).json()).latestResponse).toBeNull()

    await page.context().clearCookies()
    await page.context().addCookies([cm.cookie])
    await page.goto('/feedback/review')
    await expect(page.getByRole('heading', { name: 'Review queue', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Make group invitations clearer', exact: true }).click()
    await expect(page.getByLabel('Official response', { exact: true })).toBeHidden()
    await page.getByText('Publish an official response', { exact: true }).click()
    const composer = page.getByRole('form', { name: 'Publish official response' })
    await composer
      .getByLabel('Official response', { exact: true })
      .fill('We acknowledge the issue and are evaluating invitation visibility.')
    await composer.getByLabel('Status change', { exact: true }).selectOption('reviewing')
    await composer.getByRole('button', { name: 'Publish official response', exact: true }).click()
    await expect(outcome).toContainText('We acknowledge the issue')
    await expect(outcome).toContainText('Reviewing')
    const first = (await (await request.get(`${base}/outcome`)).json()).latestResponse
    await page.getByRole('button', { name: 'Questions', exact: true }).click()
    await expect(outcome).toContainText(first.body)
    await expect(page.locator(`#comment-${commentId}`)).toBeVisible()
    await page.evaluate(() => Reflect.set(window, 'opineResponseNavigationMarker', 'same-document'))
    await outcome.getByRole('link', { name: 'Response link', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`response=${first.id}`))
    await expect(page.locator(`#response-${first.id}`)).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, 'opineResponseNavigationMarker'))).toBe(
      'same-document',
    )
    const officialFilter = page.getByRole('button', { name: 'Official responses', exact: true })
    await officialFilter.click()
    await expect(officialFilter).toHaveAttribute('aria-pressed', 'true')
    await expect(outcome).toContainText(first.body)
    await expect(page.locator(`#response-${first.id}`)).toBeVisible()
    await expect(page.locator('article.comment')).toHaveCount(0)
    const contrasts = await page
      .locator('article.official-response')
      .first()
      .evaluate((card) => {
        const luminance = (color: string) => {
          const rgb = color
            .match(/\d+(?:\.\d+)?/g)!
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const channel = value / 255
              return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
            })
          return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
        }
        const background = luminance(getComputedStyle(card).backgroundColor)
        return Array.from(card.querySelectorAll('p, a')).map((element) => {
          const foreground = luminance(getComputedStyle(element).color)
          return (
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
          )
        })
      })
    for (const contrast of contrasts) expect(contrast).toBeGreaterThanOrEqual(4.5)
    await page.setViewportSize({ width: 375, height: 812 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('official-outcome-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    const proposalHeading = await page
      .getByRole('heading', { name: 'Make group invitations clearer', exact: true })
      .boundingBox()
    const sidebar = await page
      .getByRole('complementary', { name: 'Status and following' })
      .boundingBox()
    const featured = await outcome.locator('article.official-response').boundingBox()
    const discussionHeading = await page
      .getByRole('heading', { name: 'Community contributions', exact: true })
      .boundingBox()
    expect(proposalHeading).not.toBeNull()
    expect(sidebar).not.toBeNull()
    expect(featured).not.toBeNull()
    expect(discussionHeading).not.toBeNull()
    expect(sidebar!.x).toBeGreaterThan(proposalHeading!.x)
    expect(featured!.y).toBeGreaterThan(proposalHeading!.y)
    expect(discussionHeading!.y).toBeGreaterThan(featured!.y)
    await page.screenshot({
      path: testInfo.outputPath('official-outcome-desktop.png'),
      fullPage: true,
    })

    await page.context().clearCookies()
    await page.context().addCookies([follower.cookie])
    await page.goto('/feedback/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
    await page.getByRole('link', { name: /Make group invitations clearer/ }).click()
    await expect(page).toHaveURL(new RegExp(`response=${first.id}`))
    await expect(page.locator(`#response-${first.id}`)).toContainText(first.body)
    await page.goto('/feedback/notifications')
    await page.getByRole('button', { name: 'Mark as read', exact: true }).click()
    await expect(page.getByText('No unread notifications.', { exact: true })).toBeVisible()
    expect(
      (
        await (
          await request.get('/api/feedback/notifications', {
            headers: { cookie: follower.cookieHeader },
          })
        ).json()
      ).unreadCount,
    ).toBe(0)
    await page.goto(`/feedback/${postId}`)
    await page.getByRole('button', { name: 'Unfollow updates', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Follow updates', exact: true })).toBeVisible()

    const secondResult = await request.post(`${base}/responses`, {
      headers: headers(cm.cookieHeader),
      data: { body: 'We are collecting examples from longer play sessions.', version: 2 },
    })
    expect(secondResult.status()).toBe(201)
    await secondResult.json()
    await page.reload()
    await expect(outcome).toContainText('We are collecting examples')
    await expect(outcome).toContainText('Reviewing')
    expect((await (await request.get(`${base}/outcome`)).json()).statusResponse.id).toBe(first.id)
    const authorInbox = await (
      await request.get('/api/feedback/notifications', { headers: { cookie: author.cookieHeader } })
    ).json()
    expect(authorInbox.unreadCount).toBe(2)
    const followerInbox = await (
      await request.get('/api/feedback/notifications', {
        headers: { cookie: follower.cookieHeader },
      })
    ).json()
    expect(followerInbox.notifications).toHaveLength(1)
    expect(followerInbox.notifications[0].readAt).toBeTruthy()
  } finally {
    if (postId) {
      await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, postId))
      await getDatabase()
        .delete(feedbackOfficialResponse)
        .where(eq(feedbackOfficialResponse.postId, postId))
      await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, postId))
    }
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    for (const member of [author, follower, cm]) await member.cleanup()
  }
})

test('official writes and private queues enforce roles, origin, ownership, and validation', async ({
  request,
}) => {
  const member = await createMember()
  const cm = await createMember({ roles: ['community-manager'] })
  const admin = await createMember({ roles: ['administrator'] })
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  const base = `/api/feedback/posts/${post.id}`
  try {
    for (const cookie of [member.cookieHeader, admin.cookieHeader]) {
      expect((await request.get('/api/feedback/review', { headers: { cookie } })).status()).toBe(
        403,
      )
      expect(
        (
          await request.post(`${base}/responses`, {
            headers: headers(cookie),
            data: { body: 'Not official', version: 1 },
          })
        ).status(),
      ).toBe(403)
      expect(
        (
          await request.patch(`${base}/category`, {
            headers: headers(cookie),
            data: { categoryId: category.id, version: 1 },
          })
        ).status(),
      ).toBe(403)
    }
    for (const url of ['/api/feedback/review', '/api/feedback/notifications'])
      expect((await request.get(url)).status()).toBe(401)
    const writes = [
      { method: 'POST', url: `${base}/responses`, data: { body: 'A response', version: 1 } },
      { method: 'PUT', url: `${base}/follow`, data: { following: true } },
      { method: 'PATCH', url: `${base}/category`, data: { categoryId: category.id, version: 1 } },
    ]
    for (const write of writes) {
      expect(
        (
          await request.fetch(write.url, {
            ...write,
            headers: { origin: process.env.BETTER_AUTH_URL!, 'Idempotency-Key': randomUUID() },
          })
        ).status(),
      ).toBe(401)
      expect(
        (
          await request.fetch(write.url, {
            ...write,
            headers: { ...headers(cm.cookieHeader), origin: 'https://invalid.example' },
          })
        ).status(),
      ).toBe(403)
    }
    for (const data of [
      { body: '', version: 1 },
      { body: 'Invalid', version: 1, status: 'closed' },
      { body: 'Forged', version: 1, authorId: member.user.id },
      { body: 'Missing version' },
    ])
      expect(
        (
          await request.post(`${base}/responses`, { headers: headers(cm.cookieHeader), data })
        ).status(),
      ).toBe(400)
    expect(
      (
        await request.put(`${base}/follow`, {
          headers: headers(member.cookieHeader),
          data: { following: true },
        })
      ).status(),
    ).toBe(200)
    const result = await request.post(`${base}/responses`, {
      headers: headers(cm.cookieHeader),
      data: { body: 'An official answer', status: 'answered', version: 1 },
    })
    expect(result.status()).toBe(201)
    const responseId = (await result.json()).id
    const inbox = await (
      await request.get('/api/feedback/notifications', { headers: { cookie: member.cookieHeader } })
    ).json()
    expect(inbox.notifications).toHaveLength(1)
    const notification = `/api/feedback/notifications/${inbox.notifications[0].id}`
    expect(
      (
        await request.patch(notification, {
          headers: headers(admin.cookieHeader),
          data: { read: true },
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await request.patch(notification, {
          headers: { ...headers(member.cookieHeader), origin: 'https://invalid.example' },
          data: { read: true },
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await request.get('/api/feedback/notifications', {
          headers: { cookie: admin.cookieHeader },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await (
          await request.get('/api/feedback/notifications', {
            headers: { cookie: admin.cookieHeader },
          })
        ).json()
      ).notifications,
    ).toHaveLength(0)
    const publicResponse = await (await request.get(`${base}/responses/${responseId}`)).json()
    expect(publicResponse.response.body).toBe('An official answer')
    expect(JSON.stringify(publicResponse)).not.toContain(member.user.email)
    expect(
      (
        await request.patch(`${base}/comments/${responseId}`, {
          headers: headers(cm.cookieHeader),
          data: { body: 'Mutated official record', version: 1 },
        })
      ).status(),
    ).toBe(404)
  } finally {
    await getDatabase()
      .delete(feedbackOfficialResponse)
      .where(eq(feedbackOfficialResponse.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    for (const actor of [member, cm, admin]) await actor.cleanup()
  }
})

test('official response retries after a lost reply and conflict review preserve the intended publication', async ({
  page,
  request,
}) => {
  const cm = await createMember({ roles: ['community-manager'] })
  const otherCm = await createMember({ roles: ['community-manager'] })
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: cm.user.id, categoryId: category.id })
  const base = `/api/feedback/posts/${post.id}`
  try {
    await page.context().addCookies([cm.cookie])
    await page.goto(`/feedback/${post.id}`)
    await expect(page.getByLabel('Official response', { exact: true })).toBeHidden()
    await page.getByText('Publish an official response', { exact: true }).click()
    const composer = page.getByRole('form', { name: 'Publish official response' })
    await composer
      .getByLabel('Official response', { exact: true })
      .fill('We plan to improve the invitation signal.')
    await composer.getByLabel('Status change', { exact: true }).selectOption('planned')
    await page.route(`**${base}/responses`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      const result = await route.fetch()
      expect(result.status()).toBe(201)
      await route.abort('failed')
    })
    await composer.getByRole('button', { name: 'Publish official response', exact: true }).click()
    await expect(
      composer.getByRole('button', { name: 'Publish official response', exact: true }),
    ).toBeEnabled()
    await page.unroute(`**${base}/responses`)
    await composer.getByRole('button', { name: 'Publish official response', exact: true }).click()
    await expect(composer.getByLabel('Official response', { exact: true })).toHaveValue('')
    expect(
      await getDatabase()
        .select()
        .from(feedbackOfficialResponse)
        .where(eq(feedbackOfficialResponse.postId, post.id)),
    ).toHaveLength(1)
    await composer
      .getByLabel('Official response', { exact: true })
      .fill('Additional details after reviewing the newer outcome.')
    const concurrent = await request.post(`${base}/responses`, {
      headers: headers(otherCm.cookieHeader),
      data: { body: 'The invitation change is now available.', status: 'delivered', version: 2 },
    })
    expect(concurrent.status()).toBe(201)
    await composer.getByRole('button', { name: 'Publish official response', exact: true }).click()
    await composer.getByRole('button', { name: 'Load latest outcome', exact: true }).click()
    await expect(composer).toContainText('Delivered')
    await composer
      .getByRole('button', { name: 'I’ve reviewed the latest outcome', exact: true })
      .click()
    await expect(composer.getByLabel('Official response', { exact: true })).toHaveValue(
      'Additional details after reviewing the newer outcome.',
    )
    await composer.getByRole('button', { name: 'Publish official response', exact: true }).click()
    await expect(composer.getByLabel('Official response', { exact: true })).toHaveValue('')
    const final = await (await request.get(`${base}/outcome`)).json()
    expect(final.status).toBe('delivered')
    expect(final.version).toBe(4)
    expect(final.latestResponse.body).toBe('Additional details after reviewing the newer outcome.')
    expect(
      await getDatabase()
        .select()
        .from(feedbackOfficialResponse)
        .where(eq(feedbackOfficialResponse.postId, post.id)),
    ).toHaveLength(3)
  } finally {
    await getDatabase()
      .delete(feedbackOfficialResponse)
      .where(eq(feedbackOfficialResponse.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await cm.cleanup()
    await otherCm.cleanup()
  }
})
