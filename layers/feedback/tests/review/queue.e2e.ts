import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { feedbackTag, feedbackPost, feedbackPostTag } from '../../server/schema.ts'
import { createTag, createFeedbackPost } from '../fixtures.ts'

test.afterAll(closeDatabase)

test('review queue pagination uses applied filters and browser history restores each queue', async ({
  page,
}) => {
  const manager = await createMember({ roles: ['community-manager'] })
  const administrator = await createMember({ roles: ['administrator'] })
  const tagA = await createTag({ name: 'Queue combat' })
  const tagB = await createTag({ name: 'Queue movement' })
  const database = getDatabase()
  try {
    const posts = await database
      .insert(feedbackPost)
      .values(
        Array.from({ length: 21 }, (_, index) => ({
          authorId: manager.user.id,
          title: `Combat queue item ${index + 1}`,
          description: 'Queue regression fixture',
          createdAt: new Date(Date.UTC(2020, 0, index + 1)),
        })),
      )
      .returning()
    await database
      .insert(feedbackPostTag)
      .values(posts.map((post) => ({ postId: post.id, tagId: tagA.id })))
    const other = await createFeedbackPost({
      authorId: manager.user.id,
      title: 'Movement queue item',
      createdAt: new Date('2020-02-01'),
    })
    await database.insert(feedbackPostTag).values({ postId: other.id, tagId: tagB.id })
    await page.context().addCookies([manager.cookie])
    await page.goto(`/feedback/review?tagId=${tagA.id}&status=new`)
    const cards = page.locator('ol.feedback-list > li')
    await expect(cards).toHaveCount(20)
    await expect(cards.first()).toContainText('Combat queue item 1')
    await page.getByLabel('Tag', { exact: true }).selectOption(tagB.id)
    const moreItems = page.getByRole('button', { name: 'Load more review items', exact: true })
    await moreItems.focus()
    await moreItems.press('Enter')
    await expect(cards).toHaveCount(21)
    await expect(cards.nth(20)).toBeFocused()
    await expect(cards.last()).toContainText('Combat queue item 21')
    await expect(page.getByRole('link', { name: 'Movement queue item', exact: true })).toHaveCount(
      0,
    )
    expect(new URL(page.url()).searchParams.get('tagId')).toBe(tagA.id)
    await page.getByRole('button', { name: 'Apply queue filters', exact: true }).click()
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Movement queue item')
    expect(new URL(page.url()).searchParams.get('tagId')).toBe(tagB.id)
    await page.goBack()
    await expect(page.getByLabel('Tag', { exact: true })).toHaveValue(tagA.id)
    await expect(cards).toHaveCount(20)
    await expect(cards.first()).toContainText('Combat queue item 1')
    await page.goForward()
    await expect(page.getByLabel('Tag', { exact: true })).toHaveValue(tagB.id)
    await expect(cards).toHaveCount(1)
    await expect(cards.first()).toContainText('Movement queue item')
    await page.context().clearCookies()
    await page.context().addCookies([administrator.cookie])
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('Only community managers')
    await expect(cards).toHaveCount(0)
  } finally {
    await database.delete(feedbackPost).where(eq(feedbackPost.authorId, manager.user.id))
    await database.delete(feedbackTag).where(inArray(feedbackTag.id, [tagA.id, tagB.id]))
    await manager.cleanup()
    await administrator.cleanup()
  }
})

test('review queue reports a missing tag catalog and can retry it independently', async ({
  page,
}) => {
  const manager = await createMember({ roles: ['community-manager'] })
  const tag = await createTag({ name: 'Recoverable tag' })
  try {
    await page.context().addCookies([manager.cookie])
    await page.route('**/api/feedback/tags', (route) => route.fulfill({ status: 503, json: {} }))
    await page.goto('/feedback/review')
    await expect(page.getByRole('alert').filter({ hasText: 'Unable to load tags.' })).toBeVisible()
    await expect(page.getByLabel('Tag', { exact: true })).toBeDisabled()
    await page.unroute('**/api/feedback/tags')
    await page.getByRole('button', { name: 'Retry tags', exact: true }).click()
    await expect(page.getByLabel('Tag', { exact: true })).toBeEnabled()
    await page.getByLabel('Tag', { exact: true }).selectOption(tag.id)
  } finally {
    await getDatabase().delete(feedbackTag).where(eq(feedbackTag.id, tag.id))
    await manager.cleanup()
  }
})
