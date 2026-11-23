import { expect, test, type Page } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../../server/db/index.ts'
import { createMember } from '../../../auth/tests/fixtures.ts'
import { feedbackComment, feedbackPost } from '../../server/schema.ts'
import { createFeedbackPost } from '../fixtures.ts'

test.afterAll(closeDatabase)

async function holdResponse(page: Page, path: string, method: string) {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${path}`, async (route) => {
    if (route.request().method() !== method) return route.continue()
    const response = await route.fetch()
    await gate
    await route.fulfill({ response })
  })
  return release
}

async function participation() {
  const author = await createMember({ name: 'Post author' })
  const member = await createMember({ name: 'Another member' })
  const post = await createFeedbackPost({ authorId: author.user.id })
  const base = `/api/feedback/posts/${post.id}`
  const headers = (cookie = member.cookieHeader) => ({
    origin: process.env.BETTER_AUTH_URL!,
    cookie,
  })
  return {
    author,
    member,
    post,
    base,
    headers,
    cleanup: async () => {
      await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
      await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
      await member.cleanup()
      await author.cleanup()
    },
  }
}

test('participation endpoints reject unauthenticated, cross-origin, and invalid writes', async ({
  request,
}) => {
  const { author, post, base, headers, cleanup } = await participation()
  try {
    const writes = [
      { method: 'POST', url: `${base}/comments`, data: { body: 'A comment', type: 'context' } },
      { method: 'PUT', url: `${base}/reactions`, data: { kind: 'agree' } },
      {
        method: 'PATCH',
        url: base,
        data: {
          title: 'Changed',
          description: post.description,
          desiredImprovement: null,
          version: 1,
        },
      },
    ]
    for (const write of writes) {
      expect(
        (
          await request.fetch(write.url, {
            method: write.method,
            data: write.data,
            headers: { origin: process.env.BETTER_AUTH_URL! },
          })
        ).status(),
      ).toBe(401)
      expect(
        (
          await request.fetch(write.url, {
            method: write.method,
            data: write.data,
            headers: { ...headers(), origin: 'https://attacker.invalid' },
          })
        ).status(),
      ).toBe(403)
    }
    for (const body of ['', 'x'.repeat(10001), 'null\0character']) {
      const response = await request.post(`${base}/comments`, {
        headers: headers(),
        data: { body, type: 'context' },
      })
      expect(response.status()).toBe(400)
      expect((await response.json()).data.fieldErrors.body).toBeTruthy()
    }
    const forgedAuthor = await request.post(`${base}/comments`, {
      headers: headers(),
      data: { body: 'Bad author', type: 'context', authorId: author.user.id },
    })
    expect(forgedAuthor.status()).toBe(400)
    expect((await forgedAuthor.json()).data.fieldErrors.form).toBeTruthy()
    expect(
      (
        await request.put(`${base}/reactions`, { headers: headers(), data: { kind: 'like' } })
      ).status(),
    ).toBe(400)
    const postEdit = {
      title: 'A clearer combat indicator',
      description: 'Make hits easier to read.',
      desiredImprovement: null,
      version: 1,
    }
    expect((await request.patch(base, { headers: headers(), data: postEdit })).status()).toBe(403)
    expect(
      (
        await request.patch(base, {
          headers: headers(author.cookieHeader),
          data: { ...postEdit, status: 'planned' },
        })
      ).status(),
    ).toBe(400)
  } finally {
    await cleanup()
  }
})

test('post edits reject repeated stale versions', async ({ request }) => {
  const { author, base, headers, cleanup } = await participation()
  try {
    const postEdit = {
      title: 'A clearer combat indicator',
      description: 'Make hits easier to read.',
      desiredImprovement: null,
      version: 1,
    }
    const firstEdit = await request.patch(base, {
      headers: headers(author.cookieHeader),
      data: postEdit,
    })
    expect(firstEdit.status()).toBe(200)
    expect((await firstEdit.json()).version).toBe(2)
    expect(
      (
        await request.patch(base, {
          headers: headers(author.cookieHeader),
          data: postEdit,
        })
      ).status(),
    ).toBe(409)
    expect(
      (
        await request.patch(base, {
          headers: headers(author.cookieHeader),
          data: { ...postEdit, title: 'Stale edit' },
        })
      ).status(),
    ).toBe(409)
    const publicPost = (await (await request.get(base)).json()).post
    expect(publicPost.canEdit).toBe(false)
    expect(publicPost.editedAt).toBeTruthy()
    expect(publicPost.version).toBe(2)
    expect(
      (await (await request.get(base, { headers: { cookie: author.cookieHeader } })).json()).post
        .canEdit,
    ).toBe(true)
    expect(JSON.stringify(publicPost)).not.toContain(author.user.email)
  } finally {
    await cleanup()
  }
})

test('comment writes create independent contributions and enforce ownership and versions', async ({
  request,
}) => {
  const { author, member, base, headers, cleanup } = await participation()
  try {
    const data = { body: 'I prefer a subtle visual indicator.', type: 'suggestion' }
    const results = await Promise.all(
      [0, 1].map(() =>
        request.post(`${base}/comments`, {
          headers: headers(member.cookieHeader),
          data,
        }),
      ),
    )
    expect(results.map((result) => result.status())).toEqual([201, 201])
    const comment = await results[0]!.json()
    expect((await results[1]!.json()).id).not.toBe(comment.id)
    const commentPath = `${base}/comments/${comment.id}`
    expect(
      (
        await request.patch(commentPath, {
          headers: headers(author.cookieHeader),
          data: { body: 'Not mine', version: 1 },
        })
      ).status(),
    ).toBe(403)
    expect(
      (
        await request.patch(commentPath, {
          headers: headers(),
          data: { body: 'A subtle configurable indicator.', version: 1 },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await request.patch(commentPath, {
          headers: headers(),
          data: { body: 'Old tab', version: 1 },
        })
      ).status(),
    ).toBe(409)
    const publicComment = (await (await request.get(commentPath)).json()).comment
    expect(publicComment.body).toBe('A subtle configurable indicator.')
    expect(publicComment.editedAt).toBeTruthy()
    expect(publicComment.canEdit).toBe(false)
    expect(JSON.stringify(publicComment)).not.toContain(member.user.email)
    expect((await request.get(`${base}/comments?limit=1000`)).status()).toBe(400)
  } finally {
    await cleanup()
  }
})

test('reaction updates set the latest requested choice', async ({ request }) => {
  const { member, base, headers, cleanup } = await participation()
  try {
    expect(
      (
        await request.put(`${base}/reactions`, {
          headers: headers(member.cookieHeader),
          data: { kind: 'agree' },
        })
      ).status(),
    ).toBe(200)
    expect(
      (
        await request.put(`${base}/reactions`, { headers: headers(), data: { kind: 'disagree' } })
      ).status(),
    ).toBe(200)
    expect(
      await (
        await request.get(`${base}/reactions`, { headers: { cookie: member.cookieHeader } })
      ).json(),
    ).toEqual({ agree: 0, disagree: 1, mine: 'disagree' })
    expect(await (await request.get(`${base}/reactions`)).json()).toEqual({
      agree: 0,
      disagree: 1,
      mine: null,
    })
    expect(
      (
        await request.put(`${base}/reactions`, { headers: headers(), data: { kind: null } })
      ).status(),
    ).toBe(200)
    expect(
      (
        await request.put(`${base}/reactions`, {
          headers: headers(member.cookieHeader),
          data: { kind: 'agree' },
        })
      ).status(),
    ).toBe(200)
    expect(await (await request.get(`${base}/reactions`)).json()).toEqual({
      agree: 1,
      disagree: 0,
      mine: null,
    })
  } finally {
    await cleanup()
  }
})

test('a lost post response reports uncertainty and the member finds the saved post', async ({
  page,
}) => {
  const member = await createMember()
  let writes = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await page.context().addCookies([member.cookie])
    await page.goto('/feedback/new')
    await page
      .getByLabel('Title', { exact: true })
      .fill('Preserve a submission when the connection drops')
    await page
      .getByLabel('Feedback', { exact: true })
      .fill('I want a reliable way to share feedback.')
    await page.route('**/api/feedback/posts', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      writes++
      await route.fetch()
      await gate
      await route.abort('failed')
    })
    await page.getByRole('button', { name: 'Submit feedback', exact: true }).click()
    await expect(page.getByLabel('Title', { exact: true })).not.toBeEditable()
    await expect(page.getByLabel('Feedback', { exact: true })).not.toBeEditable()
    release()
    await expect(page.getByRole('button', { name: 'Submit feedback', exact: true })).toBeEnabled()
    await expect(page.locator('[role="alert"]')).toBeVisible()
    await page.unroute('**/api/feedback/posts')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Preserve a submission when the connection drops',
    )
    await expect(page.getByRole('alert')).toContainText(
      'Check the feedback list before submitting again.',
    )
    await page.goto('/feedback')
    await page
      .getByRole('link', { name: 'Preserve a submission when the connection drops', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Preserve a submission when the connection drops' }),
    ).toBeVisible()
    expect(writes).toBe(1)
    expect(
      await getDatabase()
        .select()
        .from(feedbackPost)
        .where(eq(feedbackPost.authorId, member.user.id)),
    ).toHaveLength(1)
  } finally {
    release()
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.authorId, member.user.id))
    await member.cleanup()
  }
})

test('an uncertain comment submission is inspected after reload without automatic resubmission', async ({
  page,
}) => {
  const { member, post, base, cleanup } = await participation()
  let writes = 0
  try {
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await page.getByRole('radio', { name: 'Question', exact: true }).check()
    await page.getByLabel('Add a comment', { exact: true }).fill('Can the indicator be configured?')
    await page.route(`**${base}/comments`, async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      writes++
      expect((await route.fetch()).status()).toBe(201)
      await route.abort('failed')
    })
    await page.getByRole('button', { name: 'Submit comment', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(
      'Check the current content before submitting again.',
    )
    await page.unroute(`**${base}/comments`)
    await page.reload()
    await expect(page.locator('article.comment')).toHaveCount(1)
    await expect(page.locator('article.comment')).toContainText('Can the indicator be configured?')
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('')
    expect(writes).toBe(1)
  } finally {
    await cleanup()
  }
})

test('members page through discussion and change or remove their reaction', async ({ page }) => {
  const member = await createMember({ name: 'Mira' })
  const other = await createMember({ name: 'Jules' })
  const post = await createFeedbackPost({ authorId: member.user.id })
  try {
    await getDatabase()
      .insert(feedbackComment)
      .values(
        Array.from({ length: 22 }, (_, index) => ({
          postId: post.id,
          authorId: other.user.id,
          body: `Earlier discussion ${index + 1}`,
          createdAt: new Date(Date.UTC(2026, 0, 1, 12, index)),
        })),
      )
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await expect(page.locator('article.comment')).toHaveCount(20)
    const moreComments = page.getByRole('button', { name: 'Load more comments' })
    await moreComments.focus()
    await moreComments.press('Enter')
    await expect(page.locator('article.comment')).toHaveCount(22)
    await expect(page.locator('article.comment').nth(20)).toBeFocused()
    await page.getByRole('button', { name: /^Agree 0$/ }).click()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: /^Disagree 0$/ }).click()
    await expect(page.getByRole('button', { name: /^Agree 0$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(page.getByRole('button', { name: /^Disagree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: /^Disagree 1$/ }).click()
    await expect(page.getByRole('button', { name: /^Disagree 0$/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await page.getByRole('button', { name: /^Agree 0$/ }).click()
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await other.cleanup()
    await member.cleanup()
  }
})

test('members submit and edit comments, then review conflicting post edits', async ({
  page,
  request,
}, testInfo) => {
  const member = await createMember({ name: 'Mira' })
  const post = await createFeedbackPost({ authorId: member.user.id })
  const base = `/api/feedback/posts/${post.id}`
  const pendingResponses: (() => void)[] = []
  const originalComment =
    'I support this idea. See https://example.com/feedback for details. javascript:alert(1) is plain text.'
  try {
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    // The invitation to expand on a reaction appears after choosing one.
    await page.getByRole('button', { name: /^Agree 0$/ }).click()
    await page.getByRole('button', { name: 'Add a comment', exact: true }).click()
    await expect(page.getByLabel('Add a comment', { exact: true })).toBeFocused()
    await page.getByRole('radio', { name: 'Context or example', exact: true }).check()
    await page.getByLabel('Add a comment', { exact: true }).fill(originalComment)
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue(originalComment)
    await expect(page.getByRole('radio', { name: 'Context or example', exact: true })).toBeChecked()

    const rulesPopup = page.waitForEvent('popup')
    await page
      .getByRole('link', { name: 'community rules (opens in a new tab)', exact: true })
      .click()
    const rulesPage = await rulesPopup
    await expect(
      rulesPage.getByRole('heading', { name: 'Community rules', exact: true }),
    ).toBeVisible()
    await rulesPage.close()
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue(originalComment)

    const releaseComment = await holdResponse(page, `${base}/comments`, 'POST')
    pendingResponses.push(releaseComment)
    await page.getByRole('button', { name: 'Submit comment', exact: true }).click()
    await expect(page.getByLabel('Add a comment', { exact: true })).not.toBeEditable()
    releaseComment()
    await page.waitForURL(/\?comment=/)
    const commentId = new URL(page.url()).searchParams.get('comment')!
    const comment = page.locator(`#comment-${commentId}`)
    await expect(comment).toContainText(originalComment)
    await expect(
      comment.getByRole('link', { name: 'https://example.com/feedback' }),
    ).toHaveAttribute('href', 'https://example.com/feedback')
    await expect(comment.locator('a[href^="javascript:"]')).toHaveCount(0)
    await expect(page.getByLabel('Add a comment', { exact: true })).toHaveValue('')
    await comment.getByRole('button', { name: 'Edit comment', exact: true }).click()
    const revisedComment = 'I support this idea, especially a configurable indicator.'
    await comment.getByLabel('Edit comment', { exact: true }).fill(revisedComment)
    const releaseEdit = await holdResponse(page, `${base}/comments/${commentId}`, 'PATCH')
    pendingResponses.push(releaseEdit)
    await comment.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(comment.getByLabel('Edit comment', { exact: true })).not.toBeEditable()
    releaseEdit()
    await expect(comment).toContainText(revisedComment)
    await expect(comment).toContainText('Edited')
    await page.getByRole('button', { name: 'Edit feedback', exact: true }).click()
    await page.getByLabel('Title', { exact: true }).fill('Make combat indicators configurable')
    expect(
      (
        await request.patch(base, {
          headers: {
            origin: process.env.BETTER_AUTH_URL!,
            cookie: member.cookieHeader,
          },
          data: {
            title: 'A change from another tab',
            description: post.description,
            desiredImprovement: null,
            version: 1,
          },
        })
      ).status(),
    ).toBe(200)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Load latest version' })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(
      'Make combat indicators configurable',
    )
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Load latest version' }).click()
    await expect(page.getByText('A change from another tab', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'I’ve reviewed the latest version' }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Make combat indicators configurable', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit feedback', exact: true })).toBeVisible()
    await expect(page.locator(`#comment-${commentId}`)).toContainText(revisedComment)
    await page.screenshot({
      path: testInfo.outputPath('participation-desktop.png'),
      fullPage: true,
    })
    await page.setViewportSize({ width: 375, height: 812 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('participation-mobile.png'), fullPage: true })
  } finally {
    pendingResponses.forEach((release) => release())
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await member.cleanup()
  }
})

test('a lost reaction response refreshes the saved choice without replay after reload', async ({
  page,
}) => {
  const member = await createMember()
  const post = await createFeedbackPost({ authorId: member.user.id })
  const path = `/api/feedback/posts/${post.id}/reactions`
  let writes = 0
  page.on('request', (request) => {
    if (request.method() === 'PUT' && new URL(request.url()).pathname === path) {
      writes++
    }
  })
  try {
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await page.route(`**${path}`, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      await route.fetch()
      await route.abort('failed')
    })
    await page.getByRole('button', { name: /^Agree 0$/ }).click()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.unroute(`**${path}`)
    await page.reload()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toBeEnabled()
    await expect(page.getByRole('button', { name: /^Agree 1$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(writes).toBe(1)
  } finally {
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await member.cleanup()
  }
})

test('a rejected comment type is rendered once with one accessible error identifier', async ({
  page,
}) => {
  const member = await createMember()
  const post = await createFeedbackPost({ authorId: member.user.id })
  const [comment] = await getDatabase()
    .insert(feedbackComment)
    .values({
      postId: post.id,
      authorId: member.user.id,
      body: 'An existing contribution',
      type: 'context',
    })
    .returning()
  const endpoint = `/api/feedback/posts/${post.id}/comments/${comment!.id}`
  try {
    await page.context().addCookies([member.cookie])
    await page.goto(`/feedback/${post.id}`)
    await page.getByRole('button', { name: 'Edit comment', exact: true }).click()
    await page.route(`**${endpoint}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              statusCode: 400,
              statusMessage: 'Check your comment.',
              data: { fieldErrors: { type: 'Choose an available contribution type.' } },
            }),
          })
        : route.continue(),
    )
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect(
      page.getByText('Choose an available contribution type.', { exact: true }),
    ).toHaveCount(1)
    await expect(page.locator(`[id="${endpoint}-type-error"]`)).toHaveCount(1)
  } finally {
    await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
    await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
    await member.cleanup()
  }
})
