import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import { feedbackCategory, feedbackFollow, feedbackPost } from '../server/schema.ts'

test.afterAll(closeDatabase)

test('the same shared link, author follow, and session survive database and app restart', async ({
  page,
  request,
}) => {
  if (process.env.OPINE_TEST_PHASE !== 'restart' || !process.env.OPINE_TEST_ARTIFACT_DIR)
    throw new Error('Run through pnpm test:e2e after the publication journey.')
  const saved: {
    path: string
    postId: string
    userId: string
    categoryId: string
    cookie: { name: string; value: string; url: string }
  } = JSON.parse(
    await readFile(join(process.env.OPINE_TEST_ARTIFACT_DIR, 'published-feedback.json'), 'utf8'),
  )
  try {
    await page.goto(saved.path)
    await expect(
      page.getByRole('heading', { name: 'Getting a group together takes most of my evening' }),
    ).toBeVisible()
    await expect(page.getByText('Aster', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Sign in with Discord', exact: true }),
    ).toBeVisible()
    const response = await request.get(`/api/feedback/posts/${saved.postId}`)
    expect(response.status()).toBe(200)
    expect((await response.json()).post.status).toBe('new')
    const [follow] = await getDatabase()
      .select()
      .from(feedbackFollow)
      .where(eq(feedbackFollow.postId, saved.postId))
    expect(follow?.userId).toBe(saved.userId)
    await page.context().addCookies([saved.cookie])
    await page.reload()
    await expect(page.getByText('Signed in as Aster')).toBeVisible()
  } finally {
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, saved.postId))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, saved.categoryId))
    await getDatabase().delete(user).where(eq(user.id, saved.userId))
  }
})
