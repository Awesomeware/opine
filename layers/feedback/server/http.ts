import { fromNodeHeaders } from 'better-auth/node'
import { createError, getHeader, getRouterParam, setResponseHeader, type H3Event } from 'h3'
import { hasRole, type PrivilegedRole } from '../../auth/shared/roles.ts'
import { getAccess } from '../../auth/server/access.ts'
import { isUuid } from '../shared/input.ts'
import { FeedbackWriteError } from './writes.ts'

export async function feedbackViewer(event: H3Event, requiredRole?: PrivilegedRole) {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const access = await getAccess(fromNodeHeaders(event.node.req.headers))
  if (requiredRole) {
    if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
    if (!hasRole(access.roles, requiredRole)) {
      const roleName = requiredRole === 'administrator' ? 'Administrator' : 'Community-manager'
      throw createError({ statusCode: 403, statusMessage: `${roleName} access is required.` })
    }
  }
  return access
}

export async function feedbackActor(event: H3Event, requiredRole?: PrivilegedRole) {
  const access = await feedbackViewer(event, requiredRole)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to participate.' })
  if (getHeader(event, 'origin') !== process.env.BETTER_AUTH_URL?.trim())
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' })
  return access.user.id
}

export function feedbackParam(event: H3Event, name: string) {
  const id = getRouterParam(event, name)
  if (!isUuid(id))
    throw createError({ statusCode: 404, statusMessage: 'Feedback or comment not found.' })
  return id
}

export function validated<T>(
  parsed: { success: true; data: T } | { success: false; fieldErrors: object },
): T {
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Check your input.',
      data: { fieldErrors: parsed.fieldErrors },
    })
  return parsed.data
}

export async function feedbackResponse<T>(event: H3Event, operation: PromiseLike<T>) {
  try {
    return await operation
  } catch (error) {
    if (error instanceof FeedbackWriteError) {
      if (error.retryAfterSeconds) setResponseHeader(event, 'Retry-After', error.retryAfterSeconds)
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
}
