import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { after, afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../../../server/db/index.ts'
import { createMember } from '../tests/fixtures.ts'
import { createAuth } from './auth.ts'
import { account, rateLimit, session, user, verification } from './schema.ts'
import { getUserRoles, setUserRole } from './roles.ts'

assert.ok(process.env.OPINE_TEST_DATABASE_URL, 'Run with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)
const origin = process.env.BETTER_AUTH_URL!

after(closeDatabase)
afterEach(async () => {
  const database = getDatabase()
  await database.delete(user)
  await database.delete(verification)
  await database.delete(rateLimit)
})

function request(path: string, options: { cookie?: string; body?: unknown } = {}) {
  const headers = new Headers({ origin, 'x-opine-client-ip': '127.0.0.1' })
  if (options.cookie) headers.set('cookie', options.cookie)
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  return new Request(`${origin}/api/auth${path}`, {
    method: options.body === undefined ? 'GET' : 'POST',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

async function startDiscord(auth: ReturnType<typeof createAuth>) {
  const response = await auth.handler(
    request('/sign-in/social', {
      body: {
        provider: 'discord',
        callbackURL: '/',
        errorCallbackURL: '/sign-in',
        disableRedirect: true,
      },
    }),
  )
  assert.equal(response.status, 200)
  const body = await response.json()
  const url = new URL(body.url)
  assert.equal(url.origin, 'https://discord.com')
  const state = url.searchParams.get('state')
  assert.ok(state)
  return { state, cookie: cookies(response) }
}

test('Discord callbacks persist an internal identity and refuse implicit email linking', async (t) => {
  let discordId = '123456789012345678'
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = decodeURIComponent(input instanceof Request ? input.url : String(input))
    if (url === 'https://discord.com/api/oauth2/token') {
      return Response.json({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'identify email',
      })
    }
    if (url === 'https://discord.com/api/users/@me') {
      return Response.json({
        id: discordId,
        username: 'member',
        global_name: 'Test Member',
        discriminator: '0',
        avatar: null,
        email: 'discord@example.test',
        verified: true,
      })
    }
    throw new Error('Unexpected outgoing OAuth request.')
  })
  const auth = createAuth()
  async function signIn() {
    const start = await startDiscord(auth)
    return auth.handler(
      request(`/callback/discord?code=test-code&state=${encodeURIComponent(start.state)}`, {
        cookie: start.cookie,
      }),
    )
  }
  const first = await signIn()
  assert.equal(first.status, 302)
  assert.equal(new URL(first.headers.get('location')!, origin).pathname, '/')
  const [member] = await getDatabase().select().from(user)
  assert.ok(member)
  assert.notEqual(member.id, discordId)
  const [identity] = await getDatabase().select().from(account)
  assert.equal(identity?.accountId, discordId)
  assert.equal(identity?.userId, member.id)
  assert.notEqual(identity?.accessToken, 'test-access-token')
  const authenticated = await auth.api.getSession({
    headers: new Headers({ cookie: cookies(first) }),
  })
  assert.equal(authenticated?.user.id, member.id)

  assert.equal((await signIn()).status, 302)
  assert.deepEqual(await getDatabase().select({ id: user.id }).from(user), [{ id: member.id }])
  discordId = '987654321098765432'
  const collision = await signIn()
  assert.equal(new URL(collision.headers.get('location')!, origin).pathname, '/sign-in')
  assert.equal((await getDatabase().select().from(user)).length, 1)
  assert.equal((await getDatabase().select().from(account)).length, 1)
})

test('tampered OAuth state cannot create an identity or session', async () => {
  const auth = createAuth()
  const start = await startDiscord(auth)
  const response = await auth.handler(
    request(
      `/callback/discord?code=test-code&state=${encodeURIComponent(`${start.state}-tampered`)}`,
      { cookie: start.cookie },
    ),
  )
  assert.equal(response.status, 302)
  assert.ok(new URL(response.headers.get('location')!, origin).searchParams.has('error'))
  assert.equal((await getDatabase().select().from(user)).length, 0)
  assert.equal((await getDatabase().select().from(session)).length, 0)
})

test('sessions survive auth recreation and reject expiry, revocation, and logout reuse', async () => {
  const member = await createMember()
  const headers = new Headers({ cookie: member.cookieHeader })
  assert.equal((await createAuth().api.getSession({ headers }))?.user.id, member.user.id)
  await closeDatabase()
  assert.equal((await createAuth().api.getSession({ headers }))?.user.id, member.user.id)

  const logout = await createAuth().handler(
    request('/sign-out', { cookie: member.cookieHeader, body: {} }),
  )
  assert.equal(logout.status, 200)
  assert.equal(await createAuth().api.getSession({ headers }), null)
  const revoked = await createMember()
  await getDatabase().delete(session).where(eq(session.id, revoked.session.id))
  assert.equal(
    await createAuth().api.getSession({ headers: new Headers({ cookie: revoked.cookieHeader }) }),
    null,
  )
  const expired = await createMember({ expiresAt: new Date(Date.now() - 60_000) })
  assert.equal(
    await createAuth().api.getSession({ headers: new Headers({ cookie: expired.cookieHeader }) }),
    null,
  )
})

test('privileged roles are explicit, independent, and revocable', async () => {
  const member = await createMember()
  assert.deepEqual(await getUserRoles(member.user.id), ['member'])
  assert.equal(await setUserRole(member.user.id, 'administrator', true), true)
  assert.equal(await setUserRole(member.user.id, 'administrator', true), true)
  assert.deepEqual(await getUserRoles(member.user.id), ['member', 'administrator'])
  await setUserRole(member.user.id, 'community-manager', true)
  assert.deepEqual(
    new Set(await getUserRoles(member.user.id)),
    new Set(['member', 'administrator', 'community-manager']),
  )
  await setUserRole(member.user.id, 'administrator', false)
  assert.deepEqual(await getUserRoles(member.user.id), ['member', 'community-manager'])
  assert.equal(await setUserRole('missing-user', 'administrator', true), false)
  assert.deepEqual(await getUserRoles('missing-user'), [])

  const execute = promisify(execFile)
  const script = fileURLToPath(new URL('../../../scripts/auth-role.ts', import.meta.url))
  const granted = await execute(process.execPath, [
    script,
    'grant',
    member.user.id,
    'administrator',
  ])
  assert.match(granted.stdout, /Role granted\./)
  assert.deepEqual(
    new Set(await getUserRoles(member.user.id)),
    new Set(['member', 'administrator', 'community-manager']),
  )
  const revoked = await execute(process.execPath, [
    script,
    'revoke',
    member.user.id,
    'administrator',
  ])
  assert.match(revoked.stdout, /Role revoked\./)
  assert.deepEqual(await getUserRoles(member.user.id), ['member', 'community-manager'])
  await assert.rejects(
    execute(process.execPath, [script, 'grant', 'missing-user', 'administrator']),
    {
      code: 1,
      stderr: /User not found\./,
    },
  )
  await assert.rejects(execute(process.execPath, [script, 'grant', member.user.id, 'member']), {
    code: 1,
    stderr: /Usage:/,
  })
  assert.deepEqual(await getUserRoles(member.user.id), ['member', 'community-manager'])
})

test('HTTP social sign-in rate limit returns 429 after the configured allowance', async () => {
  const auth = createAuth()
  const maximum = Number(process.env.AUTH_SIGN_IN_MAX ?? 10)
  for (let index = 0; index < maximum; index++) await startDiscord(auth)
  const response = await auth.handler(
    request('/sign-in/social', {
      body: { provider: 'discord', callbackURL: '/', disableRedirect: true },
    }),
  )
  assert.equal(response.status, 429)
  assert.ok(Number(response.headers.get('x-retry-after')) > 0)
})
