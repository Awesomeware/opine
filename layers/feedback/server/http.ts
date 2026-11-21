import { fromNodeHeaders } from 'better-auth/node'
import { createError, getHeader, getRouterParam, setResponseHeader, type H3Event } from 'h3'
import { getAccess } from '../../auth/server/access.ts'
import { isUuid } from '../shared/input.ts'
import { FeedbackWriteError } from './writes.ts'

export async function feedbackViewer(event: H3Event) {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return getAccess(fromNodeHeaders(event.node.req.headers))
}
export async function feedbackActor(event: H3Event) {
  const access = await feedbackViewer(event)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to participate.' })
  if (getHeader(event, 'origin') !== process.env.BETTER_AUTH_URL?.trim())
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' })
  const requestId = getHeader(event, 'idempotency-key')
  if (!isUuid(requestId))
    throw createError({ statusCode: 400, statusMessage: 'A UUID Idempotency-Key is required.' })
  return { actorId: access.user.id, requestId }
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
export async function feedbackResponse<T>(event: H3Event, operation: () => Promise<T>) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof FeedbackWriteError) {
      if (error.retryAfterSeconds) setResponseHeader(event, 'Retry-After', error.retryAfterSeconds)
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
}
