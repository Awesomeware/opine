import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import { feedbackCategory, feedbackComment, feedbackPost } from '../server/schema.ts'
import { createCategory, createFeedbackPost } from './fixtures.ts'

test.afterAll(closeDatabase)

test('contributions require a type and filter the full discussion while preserving shared links', async ({
  page,
  request,
}, testInfo) => {
  const member = await createMember()
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  const base = `/api/feedback/posts/${post.id}/comments`
  let releasePage = () => {}
  try {
    await getDatabase()
      .insert(feedbackComment)
      .values(
        Array.from({ length: 23 }, (_, index) => ({
          postId: post.id,
          authorId: member.user.id,
          body: `Existing comment ${index}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 10, index)),
        })),
      )
    const contexts = await getDatabase()
      .insert(feedbackComment)
      .values(
        Array.from({ length: 22 }, (_, index) => ({
          postId: post.id,
          authorId: member.user.id,
          type: 'context' as const,
          body: `Concrete example ${index}`,
          createdAt: new Date(Date.UTC(2026, 0, 2, 10, index)),
        })),
      )
      .returning()
    const [suggestion] = await getDatabase()
      .insert(feedbackComment)
      .values({
        postId: post.id,
        authorId: member.user.id,
        type: 'suggestion',
        body: 'An alternative way to handle the issue.',
      })
      .returning()
    const [question] = await getDatabase()
      .insert(feedbackComment)
      .values({
        postId: post.id,
        authorId: member.user.id,
        type: 'question',
        body: 'Could the team clarify the intended behavior?',
      })
      .returning()
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await expect(page.locator('article.comment')).toHaveCount(20)
    await expect(page.locator('article.comment').first()).toContainText('Unspecified')
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await page
      .getByLabel('Add a comment', { exact: true })
      .fill('A contrasting view that needs a type.')
    await page.getByRole('button', { name: 'Submit comment', exact: true }).click()
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue(
      'A contrasting view that needs a type.',
    )
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('radio', { name: 'Different view', exact: true }).check()
    await expect(
      page.getByText('What do you see differently, and why?', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0)
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('')

    for (const data of [
      { body: 'missing' },
      { body: 'invalid', type: 'official' },
      { body: 'null', type: null },
    ]) {
      const response = await request.post(base, {
        headers: {
          origin: process.env.BETTER_AUTH_URL!,
          cookie: member.cookieHeader,
          'Idempotency-Key': randomUUID(),
        },
        data,
      })
      expect(response.status()).toBe(400)
    }
    expect((await request.get(`${base}?type=official`)).status()).toBe(400)
    expect((await request.get(`${base}?type=question&type=suggestion`)).status()).toBe(400)
    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await expect(page).toHaveURL(/contribution=context/)
    await expect(page.locator('article.comment')).toHaveCount(20)
    await expect(page.locator('article.comment').first()).toContainText('Concrete example 0')
    const gate = new Promise<void>((resolve) => {
      releasePage = resolve
    })
    let started = () => {}
    let finished = () => {}
    const pageStarted = new Promise<void>((resolve) => {
      started = resolve
    })
    const pageFinished = new Promise<void>((resolve) => {
      finished = resolve
    })
    await page.route(`**/api/feedback/posts/${post.id}/discussion?*`, async (route) => {
      const query = new URL(route.request().url()).searchParams
      if (query.get('type') !== 'context' || !query.has('cursor')) return route.continue()
      const response = await route.fetch()
      started()
      await gate
      await route.fulfill({ response })
      finished()
    })
    await page.getByRole('button', { name: 'Load more comments', exact: true }).click()
    await pageStarted
    await page.getByRole('button', { name: 'Questions', exact: true }).click()
    await expect(page.locator('article.comment')).toHaveCount(1)
    await expect(page.locator(`#comment-${question!.id}`)).toBeVisible()
    releasePage()
    await pageFinished
    await page.unroute(`**/api/feedback/posts/${post.id}/discussion?*`)
    await expect(page.locator('article.comment')).toHaveCount(1)
    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await expect(page.locator('article.comment')).toHaveCount(20)
    await page.getByRole('button', { name: 'Load more comments', exact: true }).click()
    await expect(page.locator('article.comment')).toHaveCount(22)
    const linked = contexts.at(-1)!
    await page.goto(
      `/feedback/${post.id}?contribution=question&comment=${linked.id}#comment-${linked.id}`,
    )
    await expect(page.locator(`#comment-${linked.id}`)).toContainText(linked.body)
    await expect(page.locator(`#comment-${question!.id}`)).toBeVisible()
    await page.getByRole('button', { name: 'Suggestions', exact: true }).click()
    await expect(page).toHaveURL(/contribution=suggestion/)
    await expect(page.locator(`#comment-${linked.id}`)).toBeVisible()
    await expect(page.locator(`#comment-${suggestion!.id}`)).toBeVisible()
    await expect(page.locator(`#comment-${question!.id}`)).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 812 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('typed-contributions-mobile.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.screenshot({
      path: testInfo.outputPath('typed-contributions-desktop.png'),
      fullPage: true,
    })
  } finally {
    releasePage()
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})

test('reviewing a type conflict saves the choice shown in the editor', async ({
  page,
  request,
}) => {
  const member = await createMember()
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  try {
    const [comment] = await getDatabase()
      .insert(feedbackComment)
      .values({
        postId: post.id,
        authorId: member.user.id,
        body: 'An existing example.',
        type: 'context',
      })
      .returning()
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    const card = page.locator(`#comment-${comment!.id}`)
    await card.getByRole('button', { name: 'Edit comment', exact: true }).click()
    const editor = card.locator('form')
    await expect(
      editor.getByRole('radio', { name: 'Context or example', exact: true }),
    ).toBeChecked()
    const changed = await request.patch(`/api/feedback/posts/${post.id}/comments/${comment!.id}`, {
      headers: {
        origin: process.env.BETTER_AUTH_URL!,
        cookie: member.cookieHeader,
        'Idempotency-Key': randomUUID(),
      },
      data: { body: comment!.body, type: 'question', version: 1 },
    })
    expect(changed.status()).toBe(200)
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
    await editor.getByRole('button', { name: 'Load latest version', exact: true }).click()
    await expect(editor).toContainText('Question')
    await editor
      .getByRole('button', { name: 'I’ve reviewed the latest version', exact: true })
      .click()
    await expect(
      editor.getByRole('radio', { name: 'Context or example', exact: true }),
    ).toBeChecked()
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(card.locator('form')).toHaveCount(0)
    await expect(card).toContainText('Context or example')
    await expect(card).toContainText('Edited')
    const [saved] = await getDatabase()
      .select()
      .from(feedbackComment)
      .where(eq(feedbackComment.id, comment!.id))
    expect(saved?.type).toBe('context')
    expect(saved?.version).toBe(3)
    expect(saved?.body).toBe(comment!.body)
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})

test('posting resolves its permalink once and filters leave the linked target alone', async ({
  page,
}) => {
  const member = await createMember()
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  let targetReads = 0
  page.on('request', (request) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname.startsWith(`/api/feedback/posts/${post.id}/comments/`)
    ) {
      targetReads++
    }
  })
  try {
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await page.getByRole('radio', { name: 'Context or example', exact: true }).check()
    await page.getByLabel('Add a comment', { exact: true }).fill('Permalink request regression')
    const submit = page.getByRole('button', { name: 'Submit comment', exact: true })
    await submit.click()
    await expect(page.locator('article.comment')).toContainText('Permalink request regression')
    await expect(submit).toBeEnabled()
    expect(targetReads).toBe(1)

    // Query-only navigation must not resolve or scroll to the same target again.
    await page.evaluate(() => {
      document.documentElement.dataset.targetScrolls = '0'
      Element.prototype.scrollIntoView = function () {
        document.documentElement.dataset.targetScrolls = String(
          Number(document.documentElement.dataset.targetScrolls) + 1,
        )
      }
    })
    await page.getByRole('button', { name: 'Questions', exact: true }).click()
    await expect(page).toHaveURL(/contribution=question/)
    await expect(
      page.getByText('No contributions of this type yet.', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('article.comment')).toContainText('outside the selected filter')
    expect(targetReads).toBe(1)
    expect(await page.locator('html').getAttribute('data-target-scrolls')).toBe('0')
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
    await member.cleanup()
  }
})
