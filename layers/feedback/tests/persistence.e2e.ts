import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackFollow,
  feedbackPost,
} from '../server/schema.ts'

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

test('edited content, reactions, comment links, and write receipts survive restart', async ({
  page,
  request,
}) => {
  if (process.env.OPINE_TEST_PHASE !== 'restart' || !process.env.OPINE_TEST_ARTIFACT_DIR)
    throw new Error('Run through pnpm test:e2e after the participation journey.')
  const saved: {
    postId: string
    userId: string
    otherUserId: string
    categoryId: string
    commentId: string
    commentBody: string
    originalComment: string
    commentRequestKey: string
    cookie: { name: string; value: string; url: string }
  } = JSON.parse(
    await readFile(join(process.env.OPINE_TEST_ARTIFACT_DIR, 'participation.json'), 'utf8'),
  )
  const base = `/api/feedback/posts/${saved.postId}`
  try {
    await page.goto(
      `/feedback/${saved.postId}?comment=${saved.commentId}#comment-${saved.commentId}`,
    )
    await expect(
      page.getByRole('heading', { name: 'Make combat indicators configurable' }),
    ).toBeVisible()
    await expect(page.locator(`#comment-${saved.commentId}`)).toContainText(saved.commentBody)
    await expect(page.locator(`#comment-${saved.commentId}`)).toContainText('Edited')
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit comment', exact: true })).toHaveCount(0)
    const post = (await (await request.get(base)).json()).post
    expect(post.version).toBe(3)
    expect(post.editedAt).toBeTruthy()
    const retry = await request.post(`${base}/comments`, {
      headers: {
        origin: process.env.BETTER_AUTH_URL!,
        cookie: `${saved.cookie.name}=${saved.cookie.value}`,
        'Idempotency-Key': saved.commentRequestKey,
      },
      data: { body: saved.originalComment },
    })
    expect(retry.status()).toBe(201)
    expect((await retry.json()).id).toBe(saved.commentId)
    const comment = (await (await request.get(`${base}/comments/${saved.commentId}`)).json())
      .comment
    expect(comment.body).toBe(saved.commentBody)
    expect(comment.version).toBe(2)
    expect(
      await getDatabase()
        .select()
        .from(feedbackComment)
        .where(eq(feedbackComment.postId, saved.postId)),
    ).toHaveLength(23)
    await page.context().addCookies([saved.cookie])
    await page.reload()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, saved.postId))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, saved.postId))
    await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, saved.categoryId))
    await getDatabase().delete(user).where(eq(user.id, saved.userId))
    await getDatabase().delete(user).where(eq(user.id, saved.otherUserId))
  }
})
