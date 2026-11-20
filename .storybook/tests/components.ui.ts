import { expect, test } from '@playwright/test'

const story = (id: string) => `/iframe.html?id=${id}&viewMode=story`

test('contribution choices update their prompt without an application server', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--default'))
  await page.getByRole('radio', { name: 'Question', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'Question', exact: true })).toBeChecked()
  await expect(page.getByText('What would you like clarified or answered?')).toBeVisible()
  await page.getByRole('radio', { name: 'Suggestion', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'Question', exact: true })).not.toBeChecked()
  await expect(page.getByText('What would you suggest, and how would it help?')).toBeVisible()
})

test('disabled contribution choices cannot be changed', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--disabled'))
  const choices = page.getByRole('radio')
  await expect(choices).toHaveCount(4)
  for (const choice of await choices.all()) await expect(choice).toBeDisabled()
})

test('contribution errors are associated with the group and choices', async ({ page }) => {
  await page.goto(story('feedback-contributiontype--error'))
  const group = page.getByRole('group', { name: 'Contribution type' })
  const errorId = await group.getAttribute('aria-describedby')
  expect(errorId).toBeTruthy()
  await expect(page.locator(`[id="${errorId}"]`)).toBeVisible()
  for (const choice of await page.getByRole('radio').all()) {
    await expect(choice).toHaveAttribute('aria-invalid', 'true')
  }
})

test('feedback text preserves line breaks and protects contributed links', async ({ page }) => {
  await page.goto(story('feedback-text--default'))
  const text = page.locator('.feedback-text')
  await expect(text).toHaveCSS('white-space', 'pre-wrap')
  expect(await text.textContent()).toContain('\n')
  await expect(text).toContainText('<script>alert("example")</script>')
  await expect(text).toContainText('javascript:alert(1)')
  await expect(text.locator('script')).toHaveCount(0)
  const link = text.getByRole('link')
  await expect(link).toHaveCount(1)
  await expect(link).toHaveAttribute('href', 'https://example.com/feedback')
  await expect(link).toHaveAttribute('rel', 'nofollow ugc noopener noreferrer')
})

test('buttons keep native keyboard activation and do not submit by default', async ({ page }) => {
  await page.goto(story('ui-button--default'))
  const button = page.getByRole('button', { name: 'Save changes' })
  await expect(button).toHaveAttribute('type', 'button')
  await button.evaluate((element) => {
    element.addEventListener('click', () => element.setAttribute('data-activated', 'true'))
  })
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('data-activated', 'true')
})

test('disabled and busy buttons communicate distinct states', async ({ page }) => {
  await page.goto(story('ui-button--disabled'))
  const button = page.getByRole('button', { name: 'Save changes' })
  await expect(button).toBeDisabled()
  await expect(button).not.toHaveAttribute('aria-busy', 'true')
  await page.goto(story('ui-button--busy'))
  await expect(button).toBeDisabled()
  await expect(button).toHaveAttribute('aria-busy', 'true')
})

test('long feedback links wrap at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(story('feedback-text--long-content'))
  await expect(page.locator('.feedback-text')).toBeVisible()
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(hasOverflow).toBe(false)
})

test('badges and notices render with shared theme styles and native semantics', async ({
  page,
}) => {
  await page.goto(story('ui-badge--default'))
  const badge = page.getByText('Under review', { exact: true })
  await expect(badge).toBeVisible()
  await expect(badge).toHaveCSS('color', 'rgb(242, 214, 140)')
  await page.goto(story('ui-notice--default'))
  const notice = page.getByRole('alert')
  await expect(notice).toHaveText('Please check the highlighted fields.')
  await expect(notice).toHaveCSS('background-color', 'rgb(48, 43, 39)')
})
