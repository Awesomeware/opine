import { expect, test } from '@playwright/test'
import { testCommunity } from '../helpers/community.ts'

test('renders the application with a ready database', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Community feedback', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Community feedback · Opine')

  const response = await request.get('/api/ready')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('public community settings come from the server environment and rules render as plain text', async ({
  page,
}) => {
  await page.goto('/feedback')
  await expect(page.getByRole('banner')).toContainText(testCommunity.name)
  await expect(page.getByRole('link', { name: 'Opine home', exact: true })).toBeVisible()
  const community = page.getByRole('navigation', { name: 'Community', exact: true })
  await expect(
    community.getByRole('link', { name: `Visit ${testCommunity.name}` }),
  ).toHaveAttribute('href', testCommunity.url)
  await community.getByRole('link', { name: 'Community rules', exact: true }).click()
  await expect(page).toHaveURL('/rules')
  await expect(page).toHaveTitle(`Community rules · ${testCommunity.name} · Opine`)
  await expect(page.getByRole('heading', { name: 'Community rules', exact: true })).toBeVisible()
  const rules = page.locator('.rules-text')
  await expect(rules).toHaveText(testCommunity.rules)
  await expect(rules).toHaveCSS('white-space', 'pre-wrap')
  await expect(rules.locator('img')).toHaveCount(0)

  await page.reload()
  await expect(rules).toHaveText(testCommunity.rules)
  await page.goto('/feedback/new')
  const rulesLink = page.getByRole('main').getByRole('link', { name: /community rules/i })
  const popup = page.waitForEvent('popup')
  await rulesLink.click()
  const rulesPage = await popup
  await expect(
    rulesPage.getByRole('heading', { name: 'Community rules', exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL('/feedback/new')
  await rulesPage.close()
})
