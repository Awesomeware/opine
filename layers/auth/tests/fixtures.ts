import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { makeSignature } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { eventLog } from '../../../server/events/schema.ts'
import { getDatabase } from '../../../server/db/index.ts'
import { createAuth } from '../server/auth.ts'
import { account, session, user, userRole } from '../server/schema.ts'
import type { PrivilegedRole } from '../shared/roles.ts'

export async function createMember(
  options: {
    name?: string
    email?: string
    discordId?: string
    roles?: PrivilegedRole[]
    expiresAt?: Date
  } = {},
) {
  assert.ok(
    process.env.OPINE_TEST_DATABASE_URL,
    'Member fixtures require an isolated test database.',
  )
  assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)
  const id = randomUUID()
  const database = getDatabase()
  const member = {
    id,
    name: options.name ?? 'Test Member',
    email: options.email ?? `${id}@example.test`,
    emailVerified: true,
  }
  const memberSession = {
    id: randomUUID(),
    token: randomUUID(),
    userId: id,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
  }
  await database.transaction(async (transaction) => {
    await transaction.insert(user).values(member)
    await transaction.insert(account).values({
      id: randomUUID(),
      accountId: options.discordId ?? randomUUID(),
      providerId: 'discord',
      userId: id,
    })
    await transaction.insert(session).values(memberSession)
    if (options.roles?.length) {
      await transaction.insert(userRole).values(options.roles.map((role) => ({ userId: id, role })))
    }
  })
  const context = await createAuth().$context
  const value = encodeURIComponent(
    `${memberSession.token}.${await makeSignature(memberSession.token, context.secret)}`,
  )
  const cookie = {
    name: context.authCookies.sessionToken.name,
    value,
    url: process.env.BETTER_AUTH_URL!,
  }
  return {
    user: member,
    session: memberSession,
    cookie,
    cookieHeader: `${cookie.name}=${cookie.value}`,
    cleanup: async () => {
      await getDatabase().delete(eventLog).where(eq(eventLog.actorId, id))
      await getDatabase().delete(user).where(eq(user.id, id))
    },
  }
}
