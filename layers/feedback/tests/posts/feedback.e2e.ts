import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackFollow,
  feedbackPost,
  feedbackTag,
} from '../../server/schema.ts'
import { createCategory, createFeedbackPost } from '../fixtures.ts'

test.afterAll(closeDatabase)

test('a member publishes feedback and shares a public link', async ({
  page,
  browser,
}, testInfo) => {
  const member = await createMember({ name: 'Aster' })
  const category = await createCategory({ name: 'Grouping & travel' })
  try {
    await page.context().addCookies([member.cookie])
    await page.goto('/feedback/new')
    await page
      .getByLabel('Title', { exact: true })
      .fill('Getting a group together takes most of my evening')
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await expect(page.getByRole('main').getByRole('alert')).toBeFocused()
    await expect(page.getByLabel('Feedback', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Getting a group together takes most of my evening',
    )
    await page
      .getByLabel('Feedback', { exact: true })
      .fill(
        'We spent forty minutes travelling and replacing someone who left.\nI only had ninety minutes to play. <script>window.injected = true</script>',
      )
    await page
      .getByLabel('Suggested improvement')
      .fill('Help us find nearby players so we can spend more time adventuring together.')
    await page.getByLabel('Category', { exact: true }).selectOption(category.id)
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await page.waitForURL(/\/feedback\/[0-9a-f-]{36}$/)
    await expect(
      page.getByRole('heading', { name: 'Getting a group together takes most of my evening' }),
    ).toBeVisible()
    const path = new URL(page.url()).pathname
    const postId = path.split('/').at(-1)!
    const [follow] = await getDatabase()
      .select()
      .from(feedbackFollow)
      .where(eq(feedbackFollow.postId, postId))
    expect(follow?.userId).toBe(member.user.id)
    expect(await page.evaluate(() => Object.hasOwn(window, 'injected'))).toBe(false)
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('main').getByRole('status')).toContainText('Link copied.')
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
    await page.screenshot({
      path: testInfo.outputPath('feedback-detail-desktop.png'),
      fullPage: true,
    })
    const visitor = await browser.newContext({ viewport: { width: 375, height: 812 } })
    try {
      const publicPage = await visitor.newPage()
      await publicPage.goto(page.url())
      await expect(
        publicPage.getByRole('heading', {
          name: 'Getting a group together takes most of my evening',
        }),
      ).toBeVisible()
      await expect(
        publicPage.getByRole('button', { name: 'Sign in with Discord', exact: true }),
      ).toBeVisible()
      await expect(publicPage.getByText('Aster', { exact: true })).toBeVisible()
      expect(
        await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      await publicPage.screenshot({
        path: testInfo.outputPath('feedback-detail-mobile.png'),
        fullPage: true,
      })
    } finally {
      await visitor.close()
    }
  } finally {
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.authorId, member.user.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})

test('public browsing combines filters, loads more, and handles empty and missing feedback', async ({
  page,
}, testInfo) => {
  const member = await createMember()
  const category = await createCategory({ name: 'Combat' })
  try {
    for (let index = 0; index < 23; index++) {
      await createFeedbackPost({
        authorId: member.user.id,
        categoryId: category.id,
        title: `Combat clarity ${index}`,
        status: index === 22 ? 'planned' : 'new',
      })
    }
    await page.goto(`/feedback?category=${category.slug}`)
    await expect(page.locator('article.post-row')).toHaveCount(20)
    await page.getByRole('button', { name: 'Load more feedback' }).click()
    await expect(page.locator('article.post-row')).toHaveCount(23)
    await page.getByLabel('Status', { exact: true }).selectOption('planned')
    await page.getByLabel('Search feedback').fill('Combat clarity')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page.locator('article.post-row')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Combat clarity 22', exact: true })).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('feedback-list-desktop.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 375, height: 812 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.getByLabel('Search feedback').fill('no matching experience')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page.getByRole('heading', { name: 'No feedback found' })).toBeVisible()
    await page.goto(`/feedback/${randomUUID()}`)
    await expect(page.getByRole('heading', { name: 'Feedback not found' })).toBeVisible()
    await page.goto('/feedback/new')
    await expect(page.getByRole('button', { name: 'Sign in with Discord to post' })).toBeVisible()
  } finally {
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.authorId, member.user.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})

test('submission enforces identity, origin, validation, active categories, and rate limits', async ({
  request,
  page,
}) => {
  const member = await createMember()
  const category = await createCategory()
  const origin = process.env.BETTER_AUTH_URL!
  const data = {
    title: 'Clearer combat feedback',
    description: 'Hits need more readable feedback.',
    desiredImprovement: null,
    categoryId: category.id,
  }
  const headers = { origin, cookie: member.cookieHeader, 'Idempotency-Key': randomUUID() }
  try {
    expect(
      (await request.post('/api/feedback/posts', { headers: { origin }, data })).status(),
    ).toBe(401)
    expect(
      (
        await request.post('/api/feedback/posts', {
          headers: { ...headers, origin: 'https://attacker.invalid' },
          data,
        })
      ).status(),
    ).toBe(403)
    for (const invalid of [
      { ...data, authorId: 'someone-else' },
      { ...data, status: 'planned' },
      { ...data, title: ' ' },
      { ...data, description: 'x'.repeat(10001) },
    ]) {
      expect((await request.post('/api/feedback/posts', { headers, data: invalid })).status()).toBe(
        400,
      )
    }
    expect((await request.get('/api/feedback/posts?limit=10000')).status()).toBe(400)
    expect((await request.get('/api/feedback/posts?cursor=not-valid')).status()).toBe(400)
    await page.context().addCookies([member.cookie])
    await page.goto('/feedback/new')
    await page.getByLabel('Title', { exact: true }).fill(data.title)
    await page.getByLabel('Feedback', { exact: true }).fill(data.description)
    await page.getByLabel('Category', { exact: true }).selectOption(category.id)
    await getDatabase()
      .update(feedbackCategory)
      .set({ isActive: false })
      .where(eq(feedbackCategory.id, category.id))
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await expect(page.getByLabel('Category', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(data.title)
    await getDatabase()
      .update(feedbackCategory)
      .set({ isActive: true })
      .where(eq(feedbackCategory.id, category.id))
    for (let index = 0; index < 5; index++)
      expect(
        (
          await request.post('/api/feedback/posts', {
            headers: { ...headers, 'Idempotency-Key': randomUUID() },
            data,
          })
        ).status(),
      ).toBe(201)
    const limited = await request.post('/api/feedback/posts', {
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      data,
    })
    expect(limited.status()).toBe(429)
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
    const records = await getDatabase()
      .select()
      .from(feedbackPost)
      .where(eq(feedbackPost.authorId, member.user.id))
    expect(records).toHaveLength(5)
    expect(records.every((post) => post.status === 'new')).toBe(true)
  } finally {
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.authorId, member.user.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})

test('unsaved forms clear on reload or navigation without storing browser drafts', async ({
  page,
}) => {
  const member = await createMember({ roles: ['community-manager'] })
  const category = await createCategory()
  const database = getDatabase()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  const [tag] = await database
    .insert(feedbackTag)
    .values({ name: `Temporary ${randomUUID().slice(0, 8)}` })
    .returning()
  const [comment] = await database
    .insert(feedbackComment)
    .values({
      postId: post.id,
      authorId: member.user.id,
      body: 'Published comment',
      type: 'question',
    })
    .returning()
  const assertNoStoredForms = async () => {
    expect(
      await page.evaluate(() =>
        [...Object.keys(sessionStorage), ...Object.keys(localStorage)].filter((key) =>
          key.startsWith('opine.feedback.'),
        ),
      ),
    ).toEqual([])
  }

  try {
    await page.context().addCookies([member.cookie])
    await page.goto('/feedback/new')
    const title = page.getByLabel('Title', { exact: true })
    const body = page.getByLabel('Feedback', { exact: true })
    const selectedTag = page.getByRole('checkbox', { name: tag!.name, exact: true })
    for (const leave of ['reload', 'navigate'] as const) {
      await title.fill('Unsubmitted title')
      await body.fill('Unsubmitted feedback')
      await selectedTag.check()
      await assertNoStoredForms()
      if (leave === 'reload') {
        await page.reload()
      } else {
        await page.getByRole('link', { name: '← All feedback' }).click()
        await expect(page).toHaveURL(/\/feedback$/)
        await page.goBack()
      }
      await expect(title).toHaveValue('')
      await expect(body).toHaveValue('')
      await expect(selectedTag).not.toBeChecked()
    }

    await page.goto(`/feedback/${post.id}`)
    const contribution = page.getByLabel('Add a comment', { exact: true })
    await page.getByRole('radio', { name: 'Question', exact: true }).check()
    await contribution.fill('An unsent question')
    await page.getByText('Publish an official response', { exact: true }).click()
    await page.getByLabel('Official response', { exact: true }).fill('An unpublished answer')
    await page.getByLabel('Status change', { exact: true }).selectOption('planned')
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('An unsaved title edit')
    const card = page.locator(`#comment-${comment!.id}`)
    await card.getByRole('button', { name: 'Edit comment', exact: true }).click()
    await card.getByLabel('Edit comment', { exact: true }).fill('An unsaved comment edit')
    await assertNoStoredForms()
    await page.reload()
    await expect(contribution).toHaveValue('')
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await page.getByText('Publish an official response', { exact: true }).click()
    await expect(page.getByLabel('Official response', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Status change', { exact: true })).toHaveValue('')
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(post.title)
    await card.getByRole('button', { name: 'Edit comment', exact: true }).click()
    await expect(card.getByLabel('Edit comment', { exact: true })).toHaveValue(comment!.body)
    await assertNoStoredForms()
  } finally {
    await database.delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await database.delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await database.delete(feedbackTag).where(eq(feedbackTag.id, tag!.id))
    await database.delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})
