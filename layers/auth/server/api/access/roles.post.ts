import { fromNodeHeaders } from 'better-auth/node'
import { getAccess } from '../../access.ts'
import { setUserRole } from '../../roles.ts'
import { hasRole, isPrivilegedRole } from '../../../shared/roles.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const access = await getAccess(fromNodeHeaders(event.node.req.headers))
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in required.' })
  if (!hasRole(access.roles, 'administrator')) {
    throw createError({ statusCode: 403, statusMessage: 'Administrator access required.' })
  }
  // This is outside Better Auth's router, so enforce CSRF protection here too.
  if (getHeader(event, 'origin') !== process.env.BETTER_AUTH_URL?.trim()) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' })
  }
  const body: unknown = await readBody(event)
  if (
    !body ||
    typeof body !== 'object' ||
    !('userId' in body) ||
    typeof body.userId !== 'string' ||
    !body.userId.trim() ||
    body.userId.length > 128 ||
    !('role' in body) ||
    !isPrivilegedRole(body.role) ||
    !('action' in body) ||
    (body.action !== 'grant' && body.action !== 'revoke')
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Expected userId, privileged role, and grant or revoke action.',
    })
  }
  const found = await setUserRole(body.userId, body.role, body.action === 'grant')
  if (!found) throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  return { success: true }
})
