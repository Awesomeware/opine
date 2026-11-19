import { expect, test } from '@playwright/test'

test('renders the application with a ready database', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Community feedback', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Community feedback · Opine')

  const response = await request.get('/api/ready')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
