import { expect, test } from '@playwright/test'
import { closeDatabase } from '../../../server/db/index.ts'
import { createMember } from './fixtures.ts'
import { setUserRole } from '../server/roles.ts'

test.afterAll(async () => closeDatabase())

test('visitors can start Discord sign-in and recover from an OAuth error', async ({ page }) => {
  await page.route('https://discord.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<h1>Discord test boundary</h1>',
    }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in with Discord' }).click()
  await page.waitForURL('https://discord.com/**')
  const authorize = new URL(page.url())
  expect(authorize.searchParams.get('client_id')).toBe('opine-test-client')
  expect(authorize.searchParams.get('redirect_uri')).toBe(
    `${process.env.BETTER_AUTH_URL}/api/auth/callback/discord`,
  )
  expect(authorize.searchParams.get('state')).toBeTruthy()
  await page.goto('/sign-in?error=private-provider-error')
  await expect(page.getByRole('alert')).toHaveText(
    'Sign-in was cancelled or could not be completed. Please try again.',
  )
  await expect(page.getByText('private-provider-error')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sign in with Discord' })).toBeVisible()
})

test('a database session survives reload and sign-out invalidates its cookie', async ({
  page,
  request,
}) => {
  const member = await createMember({ name: 'Test Member' })
  try {
    await page.context().addCookies([member.cookie])
    await page.goto('/')
    await expect(page.getByText('Signed in as Test Member')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Signed in as Test Member')).toBeVisible()
    await page.getByRole('button', { name: 'Sign out', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Sign in with Discord' })).toBeVisible()
    const response = await request.get('/api/access', { headers: { cookie: member.cookieHeader } })
    expect(await response.json()).toEqual({ user: null, roles: [] })
  } finally {
    await member.cleanup()
  }
})

test('only administrators manage roles, with current grants and same-origin requests', async ({
  request,
}) => {
  const member = await createMember()
  const manager = await createMember({ roles: ['community-manager'] })
  const administrator = await createMember({ roles: ['administrator'] })
  const both = await createMember({ roles: ['community-manager', 'administrator'] })
  const expired = await createMember({
    roles: ['administrator'],
    expiresAt: new Date(Date.now() - 60_000),
  })
  const origin = process.env.BETTER_AUTH_URL!
  const data = { userId: member.user.id, role: 'community-manager', action: 'grant' }
  try {
    for (const [actor, expectedStatus] of [
      [null, 401],
      [member, 403],
      [manager, 403],
      [expired, 401],
      [administrator, 200],
      [both, 200],
    ] as const) {
      const response = await request.post('/api/access/roles', {
        headers: { origin, ...(actor ? { cookie: actor.cookieHeader } : {}) },
        data,
      })
      expect(response.status()).toBe(expectedStatus)
    }
    const headers = { cookie: administrator.cookieHeader, origin }
    const self = await request.get('/api/access', { headers })
    expect(await self.json()).toEqual({
      user: { id: administrator.user.id, name: administrator.user.name },
      roles: ['member', 'administrator'],
    })
    for (const forgedOrigin of ['https://attacker.invalid', 'null', '']) {
      const denied = await request.post('/api/access/roles', {
        headers: { ...headers, origin: forgedOrigin },
        data,
      })
      expect(denied.status()).toBe(403)
    }
    for (const invalid of [
      null,
      { ...data, role: 'member' },
      { ...data, role: ['administrator'] },
      { ...data, action: 'delete' },
    ]) {
      const response = await request.post('/api/access/roles', { headers, data: invalid })
      expect(response.status()).toBe(400)
    }
    const unknown = await request.post('/api/access/roles', {
      headers,
      data: { ...data, userId: 'missing-user' },
    })
    expect(unknown.status()).toBe(404)
    const revoked = await request.post('/api/access/roles', {
      headers,
      data: { ...data, action: 'revoke' },
    })
    expect(revoked.status()).toBe(200)
    const current = await request.get('/api/access', { headers: { cookie: member.cookieHeader } })
    expect((await current.json()).roles).toEqual(['member'])
    await setUserRole(administrator.user.id, 'administrator', false)
    const denied = await request.post('/api/access/roles', { headers, data })
    expect(denied.status()).toBe(403)
    const tampered = await request.post('/api/access/roles', {
      headers: { ...headers, cookie: `${administrator.cookieHeader}tampered` },
      data,
    })
    expect(tampered.status()).toBe(401)
  } finally {
    await Promise.all(
      [member, manager, administrator, both, expired].map((fixture) => fixture.cleanup()),
    )
  }
})

test('forged IP headers cannot bypass the sign-in limit', async ({ request }) => {
  let status = 0
  for (let index = 0; index <= 10; index++) {
    const response = await request.post('/api/auth/sign-in/social', {
      headers: {
        origin: process.env.BETTER_AUTH_URL!,
        'x-opine-client-ip': `192.0.2.${index + 1}`,
        'x-forwarded-for': `192.0.2.${index + 1}`,
      },
      data: { provider: 'discord', callbackURL: '/', disableRedirect: true },
    })
    status = response.status()
    if (status === 429) break
    expect(status).toBe(200)
  }
  expect(status).toBe(429)
})
