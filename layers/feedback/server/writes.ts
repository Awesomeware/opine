import { createHash } from 'node:crypto'
import { and, count, eq, gte } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import { feedbackWriteReceipt } from './schema.ts'

export type FeedbackTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>['transaction']>[0]
>[0]
export class FeedbackWriteError extends Error {
  statusCode: number
  retryAfterSeconds?: number
  constructor(statusCode: number, message: string, retryAfterSeconds?: number) {
    super(message)
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}
export function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > 86400)
    throw new Error(`${name} must be an integer between 1 and 86400.`)
  return value
}

// Serialize an actor's writes: the receipt and its mutation always commit together.
// NO KEY UPDATE also permits notification fanout to reference other active actors.
export async function feedbackWrite<T extends { id: string; version?: number } | null>(
  actorId: string,
  requestId: string,
  operation: string,
  input: unknown,
  authorize: (transaction: FeedbackTransaction) => Promise<void>,
  mutate: (transaction: FeedbackTransaction) => Promise<T>,
  limit?: { env: string; fallback: number },
): Promise<T> {
  const requestHash = createHash('sha256')
    .update(JSON.stringify({ operation, input }))
    .digest('hex')
  return getDatabase().transaction(async (transaction) => {
    const [actor] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actorId))
      .for('no key update')
    if (!actor) throw new FeedbackWriteError(401, 'Sign in to participate.')
    await authorize(transaction)
    const [receipt] = await transaction
      .select()
      .from(feedbackWriteReceipt)
      .where(
        and(
          eq(feedbackWriteReceipt.actorId, actorId),
          eq(feedbackWriteReceipt.requestId, requestId),
        ),
      )
    if (receipt) {
      if (receipt.requestHash !== requestHash)
        throw new FeedbackWriteError(
          409,
          'This request key was already used for different content.',
        )
      return receipt.result as T
    }
    if (limit) {
      const seconds = positiveInteger('FEEDBACK_PARTICIPATION_WINDOW_SECONDS', 60)
      const max = positiveInteger(limit.env, limit.fallback)
      const [recent] = await transaction
        .select({ count: count() })
        .from(feedbackWriteReceipt)
        .where(
          and(
            eq(feedbackWriteReceipt.actorId, actorId),
            eq(feedbackWriteReceipt.operation, operation),
            gte(feedbackWriteReceipt.createdAt, new Date(Date.now() - seconds * 1000)),
          ),
        )
      if (recent && recent.count >= max)
        throw new FeedbackWriteError(429, 'Please wait before participating again.', seconds)
    }
    const result = await mutate(transaction)
    if (result)
      await transaction
        .insert(feedbackWriteReceipt)
        .values({ actorId, requestId, operation, requestHash, result })
    return result
  })
}
