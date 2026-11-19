import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { createMember } from '../../auth/tests/fixtures.ts'
import { feedbackCategory, feedbackCategoryChange, feedbackPost } from '../server/schema.ts'
import { createCategory, createFeedbackPost } from './fixtures.ts'

test.afterAll(closeDatabase)

test('review queue pagination uses applied filters and browser history restores each queue', async ({
  page,
}) => {
  const manager = await createMember({ roles: ['community-manager'] })
  const administrator = await createMember({ roles: ['administrator'] })
  const categoryA = await createCategory({ name: 'Queue combat' })
  const categoryB = await createCategory({ name: 'Queue movement' })
  const database = getDatabase()
  try {
    await database.insert(feedbackPost).values(
      Array.from({ length: 21 }, (_, index) => ({
        authorId: manager.user.id,
        categoryId: categoryA.id,
        title: `Combat queue item ${index + 1}`,
        description: 'Queue regression fixture',
        createdAt: new Date(Date.UTC(2020, 0, index + 1)),
      })),
    )
    await createFeedbackPost({
      authorId: manager.user.id,
      categoryId: categoryB.id,
      title: 'Movement queue item',
      createdAt: new Date('2020-02-01'),
    })
    await page.context().addCookies([manager.cookie])
    await page.goto(`/feedback/review?category=${categoryA.slug}&status=new`)
    const cards = page.locator('ol.feedback-list > li')
    await expect(cards).toHaveCount(20)
    await expect(cards.first()).toContainText('Combat queue item 1')
    await page.getByLabel('Category', { exact: true }).selectOption(categoryB.slug)
    await page.getByRole('button', { name: 'Load more review items', exact: true }).click()
    await expect(cards).toHaveCount(21)
    await expect(cards.last()).toContainText('Combat queue item 21')
    await expect(page.getByRole('link', { name: 'Movement queue item', exact: true })).toHaveCount(
      0,
    )
    expect(new URL(page.url()).searchParams.get('category')).toBe(categoryA.slug)
    await page.getByRole('button', { name: 'Apply queue filters', exact: true }).click()
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Movement queue item')
    expect(new URL(page.url()).searchParams.get('category')).toBe(categoryB.slug)
    await page.goBack()
    await expect(page.getByLabel('Category', { exact: true })).toHaveValue(categoryA.slug)
    await expect(cards).toHaveCount(20)
    await expect(cards.first()).toContainText('Combat queue item 1')
    await page.goForward()
    await expect(page.getByLabel('Category', { exact: true })).toHaveValue(categoryB.slug)
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Movement queue item')
    await page.context().clearCookies()
    await page.context().addCookies([administrator.cookie])
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('Only community managers')
    await expect(cards).toHaveCount(0)
  } finally {
    await database
      .delete(feedbackPost)
      .where(inArray(feedbackPost.categoryId, [categoryA.id, categoryB.id]))
    await database
      .delete(feedbackCategory)
      .where(inArray(feedbackCategory.id, [categoryA.id, categoryB.id]))
    await manager.cleanup()
    await administrator.cleanup()
  }
})

test('a disabled category rejection preserves the correction form and permits a valid audited correction', async ({
  page,
}) => {
  const manager = await createMember({
    name: 'Category representative',
    roles: ['community-manager'],
  })
  const original = await createCategory({ name: 'Original category' })
  const disabled = await createCategory({ name: 'Soon disabled category' })
  const valid = await createCategory({ name: 'Corrected category' })
  const post = await createFeedbackPost({ authorId: manager.user.id, categoryId: original.id })
  const database = getDatabase()
  try {
    await page.context().addCookies([manager.cookie])
    await page.goto(`/feedback/${post.id}`)
    await page.getByText('Correct category', { exact: true }).click()
    const select = page.getByLabel('Corrected category', { exact: true })
    await select.selectOption(disabled.id)
    await database
      .update(feedbackCategory)
      .set({ isActive: false })
      .where(eq(feedbackCategory.id, disabled.id))
    const rejected = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/posts/${post.id}/category`) &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save category correction', exact: true }).click()
    expect((await rejected).status()).toBe(400)
    await expect(select).toBeEnabled()
    await expect(
      page.getByRole('button', { name: 'Retry pending category correction', exact: true }),
    ).toHaveCount(0)
    await select.selectOption(valid.id)
    await page.getByRole('button', { name: 'Save category correction', exact: true }).click()
    await expect(page.locator('article > .eyebrow')).toHaveText(valid.name)
    await expect(page.getByText('Category corrected.', { exact: true })).toBeVisible()
    const rows = await database
      .select()
      .from(feedbackCategoryChange)
      .where(eq(feedbackCategoryChange.postId, post.id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      actorId: manager.user.id,
      previousCategoryId: original.id,
      categoryId: valid.id,
    })
    const [saved] = await database.select().from(feedbackPost).where(eq(feedbackPost.id, post.id))
    expect(saved).toMatchObject({ categoryId: valid.id, version: 1, workflowVersion: 2 })
    await page.reload()
    await page.getByText('Correct category', { exact: true }).click()
    await expect(page.locator('details.category-correction ol')).toContainText(
      'Original category → Corrected category',
    )
  } finally {
    await database.delete(feedbackCategoryChange).where(eq(feedbackCategoryChange.postId, post.id))
    await database.delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await database
      .delete(feedbackCategory)
      .where(inArray(feedbackCategory.id, [original.id, disabled.id, valid.id]))
    await manager.cleanup()
  }
})
