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

test('installation files configure the community and rules render Markdown safely', async ({
  page,
  request,
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
  await expect(rules.getByRole('heading', { name: 'Discussion', level: 2 })).toBeVisible()
  await expect(rules.locator('strong')).toHaveText('Criticism and disagreement')
  await expect(rules.getByRole('listitem')).toHaveCount(2)
  await expect(rules.getByRole('link', { name: 'Community website' })).toHaveAttribute(
    'href',
    testCommunity.url,
  )
  await expect(rules).toContainText('<img src=x onerror="window.rulesExecuted=true">')
  await expect(rules.locator('img')).toHaveCount(0)
  await expect(rules.getByRole('link', { name: 'Unsafe link' })).toHaveCount(0)
  const response = await request.get('/api/community')
  expect(response.status()).toBe(200)
  expect(Object.keys(await response.json()).sort()).toEqual(['name', 'rulesHtml', 'url'])

  await page.reload()
  await expect(rules.getByRole('heading', { name: 'Discussion', level: 2 })).toBeVisible()
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
