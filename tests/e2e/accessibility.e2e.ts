import { expect, test, type Locator } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../server/db/index.ts'
import { createMember } from '../../layers/auth/tests/fixtures.ts'
import { createCategory, createFeedbackPost } from '../../layers/feedback/tests/fixtures.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackPost,
} from '../../layers/feedback/server/schema.ts'

test.afterAll(closeDatabase)

async function feedback(options: { manager?: boolean } = {}) {
  const member = await createMember({ roles: options.manager ? ['community-manager'] : [] })
  const category = await createCategory()
  const post = await createFeedbackPost({ authorId: member.user.id, categoryId: category.id })
  return {
    member,
    category,
    post,
    async cleanup() {
      await getDatabase().delete(feedbackComment).where(eq(feedbackComment.postId, post.id))
      await getDatabase().delete(feedbackPost).where(eq(feedbackPost.id, post.id))
      await getDatabase().delete(feedbackCategory).where(eq(feedbackCategory.id, category.id))
      await member.cleanup()
    },
  }
}

async function activate(control: Locator) {
  await control.focus()
  await control.press('Enter')
}

test('public navigation exposes landmarks and moves keyboard focus into the destination', async ({
  page,
}) => {
  await page.goto('/feedback')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)
  const skip = page.getByRole('link', { name: 'Skip to content' })
  await page.keyboard.press('Tab')
  await expect(skip).toBeFocused()
  await expect(skip).toHaveCSS('outline-style', 'solid')
  await expect(skip).toBeInViewport()
  await skip.press('Enter')
  await expect(page.getByRole('main')).toBeFocused()

  await activate(
    page
      .getByRole('navigation', { name: 'Community', exact: true })
      .getByRole('link', { name: 'Community rules' }),
  )
  await expect(page).toHaveURL('/rules')
  await expect(page.getByRole('main')).toBeFocused()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Community rules')
  await expect(page.getByRole('group', { name: 'Account' })).toBeVisible()
})

test('invalid submission describes the field error, focuses its summary and retains other input', async ({
  page,
}) => {
  const fixture = await feedback()
  try {
    await page.context().addCookies([fixture.member.cookie])
    await page.goto('/feedback/new')
    const title = page.getByRole('textbox', { name: 'Title', exact: true })
    const description = page.getByRole('textbox', { name: 'Feedback', exact: true })
    const category = page.getByRole('combobox', { name: 'Category', exact: true })
    for (const field of [title, description, category])
      await expect(field).toHaveAttribute('required', '')
    await description.fill('Keep this feedback while I correct the missing title.')
    await category.selectOption(fixture.category.id)
    await activate(page.getByRole('button', { name: 'Submit feedback', exact: true }))
    await expect(page.getByRole('alert')).toBeFocused()
    await expect(title).toHaveAttribute('aria-invalid', 'true')
    await expect(title).toHaveAccessibleDescription(/Enter a title/)
    await expect(description).toHaveValue('Keep this feedback while I correct the missing title.')
    await expect(category).toHaveValue(fixture.category.id)
    await expect(description).not.toHaveAttribute('aria-invalid', 'true')
  } finally {
    await fixture.cleanup()
  }
})

test('inline editors move focus in and return it when cancelled or saved', async ({
  page,
  request,
}) => {
  const fixture = await feedback()
  try {
    const response = await request.post(`/api/feedback/posts/${fixture.post.id}/comments`, {
      headers: { cookie: fixture.member.cookieHeader, origin: process.env.BETTER_AUTH_URL! },
      data: { body: 'An example to clarify the proposal.', type: 'context' },
    })
    expect(response.status()).toBe(201)
    const comment = await response.json()
    await page.context().addCookies([fixture.member.cookie])
    await page.goto(`/feedback/${fixture.post.id}`)
    const editPost = page.getByRole('button', { name: 'Edit feedback', exact: true })
    await activate(editPost)
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeFocused()
    await activate(page.getByRole('button', { name: 'Cancel edit', exact: true }))
    await expect(editPost).toBeFocused()

    const article = page.locator(`#comment-${comment.id}`)
    const editComment = article.getByRole('button', { name: 'Edit comment', exact: true })
    await activate(editComment)
    const body = article.getByRole('textbox', { name: 'Edit comment', exact: true })
    await expect(body).toBeFocused()
    await activate(article.getByRole('button', { name: 'Cancel edit', exact: true }))
    await expect(editComment).toBeFocused()
    await activate(editComment)
    await body.fill('An edited example to clarify the proposal.')
    await activate(article.getByRole('button', { name: 'Save changes', exact: true }))
    await expect(article.getByText('Edited', { exact: true })).toBeVisible()
    await expect(editComment).toBeFocused()

    const contextFilter = page
      .getByRole('navigation', { name: 'Filter contributions' })
      .getByRole('button', { name: 'Context', exact: true })
    await activate(contextFilter)
    await expect(contextFilter).toHaveAttribute('aria-pressed', 'true')
    await activate(editComment)
    await article.getByRole('radio', { name: 'Different view', exact: true }).check()
    await activate(article.getByRole('button', { name: 'Save changes', exact: true }))
    await expect(article).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: 'Community contributions', exact: true }),
    ).toBeFocused()
  } finally {
    await fixture.cleanup()
  }
})

test('keyboard contributions, reactions and filters expose their selected state without losing focus', async ({
  page,
}) => {
  const fixture = await feedback()
  try {
    await page.context().addCookies([fixture.member.cookie])
    await page.goto(`/feedback/${fixture.post.id}`)
    const context = page.getByRole('radio', { name: 'Context or example', exact: true })
    await expect(context).toHaveAttribute('required', '')
    await context.focus()
    await context.press('Space')
    await expect(context).toBeChecked()
    await context.press('ArrowRight')
    const different = page.getByRole('radio', { name: 'Different view', exact: true })
    await expect(different).toBeChecked()
    await expect(different).toBeFocused()
    await expect(different).toHaveAccessibleDescription(/different|see|perspective/i)
    await page
      .getByRole('textbox', { name: 'Add a comment', exact: true })
      .fill('I find the existing cue useful at this scale.')
    await activate(page.getByRole('button', { name: 'Submit comment', exact: true }))
    await expect(
      page.getByText('I find the existing cue useful at this scale.', { exact: true }),
    ).toBeVisible()
    const reactions = page.getByRole('region', { name: 'Reactions', exact: true })
    const agree = reactions.getByRole('button', { name: /^Agree/ })
    await activate(agree)
    await expect(agree).toHaveAttribute('aria-pressed', 'true')
    await expect(reactions.getByRole('button', { name: /^Disagree/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const filter = page
      .getByRole('navigation', { name: 'Filter contributions' })
      .getByRole('button', { name: 'Different views', exact: true })
    await activate(filter)
    await expect(filter).toHaveAttribute('aria-pressed', 'true')
    await expect(filter).toBeFocused()
    await expect(
      page.getByText('I find the existing cue useful at this scale.', { exact: true }),
    ).toBeVisible()
  } finally {
    await fixture.cleanup()
  }
})

test('manager tools support keyboard disclosure, lock focus and archive confirmation at narrow widths', async ({
  page,
}) => {
  const fixture = await feedback({ manager: true })
  try {
    await page.context().addCookies([fixture.member.cookie])
    await page.setViewportSize({ width: 320, height: 720 })
    await page.goto(`/feedback/${fixture.post.id}`)
    const disclosure = page.locator('summary').filter({ hasText: 'Publish an official response' })
    await activate(disclosure)
    await expect(page.getByRole('form', { name: 'Publish official response' })).toBeVisible()
    await disclosure.press('Enter')
    await expect(page.getByRole('form', { name: 'Publish official response' })).toBeHidden()
    await activate(page.getByRole('button', { name: 'Lock feedback', exact: true }))
    const unlock = page.getByRole('button', { name: 'Unlock feedback', exact: true })
    await expect(unlock).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Locked' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Agree/ })).toBeDisabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true)
    await activate(unlock)
    await expect(page.getByRole('button', { name: 'Lock feedback', exact: true })).toBeFocused()

    const archive = page.getByRole('button', { name: 'Archive feedback', exact: true })
    await activate(archive)
    await expect(archive).toHaveAttribute('aria-expanded', 'true')
    const confirmationId = await archive.getAttribute('aria-controls')
    expect(confirmationId).toBeTruthy()
    const confirmation = page.locator(`[id="${confirmationId}"]`)
    await expect(confirmation).toContainText('There is no restore option')
    await expect(page.getByRole('button', { name: 'Confirm archive', exact: true })).toBeFocused()
    await activate(confirmation.getByRole('button', { name: 'Cancel', exact: true }))
    await expect(archive).toBeFocused()
    await expect(archive).toHaveAttribute('aria-expanded', 'false')
    await activate(archive)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/feedback')
    await expect(page.getByRole('main')).toBeFocused()
  } finally {
    await fixture.cleanup()
  }
})
