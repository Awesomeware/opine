import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import { feedbackCategory, feedbackPost, feedbackTag } from '../server/schema.ts'

test.afterAll(closeDatabase)

test('optional tag selections remain public after restarting the database and application', async ({
  page,
  request,
}) => {
  const directory = process.env.OPINE_TEST_ARTIFACT_DIR
  if (!directory) throw new Error('Run through pnpm test:e2e for the restart check.')
  const saved: {
    postId: string
    categoryId: string
    tagIds: string[]
    names: string[]
    userIds: string[]
  } = JSON.parse(await readFile(join(directory, 'tagged-feedback.json'), 'utf8'))
  const database = getDatabase()
  try {
    const response = await request.get(`/api/feedback/posts/${saved.postId}`)
    expect(response.ok()).toBe(true)
    const post = (await response.json()).post
    expect(post.tags.map((tag: { id: string }) => tag.id).sort()).toEqual(saved.tagIds.sort())
    expect(post.version).toBe(4)
    await page.goto(`/feedback/${saved.postId}`)
    for (const name of saved.names)
      await expect(page.getByText(name, { exact: true })).toBeVisible()
  } finally {
    await database.delete(feedbackPost).where(eq(feedbackPost.categoryId, saved.categoryId))
    await database.delete(feedbackTag).where(inArray(feedbackTag.id, saved.tagIds))
    await database.delete(feedbackCategory).where(eq(feedbackCategory.id, saved.categoryId))
    await database.delete(user).where(inArray(user.id, saved.userIds))
  }
})
