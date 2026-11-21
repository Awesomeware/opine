import { and, count, eq, gte } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { user } from '../../auth/server/schema.ts'
import { feedbackWriteReceipt } from './schema.ts'
import { FeedbackWriteError, positiveInteger, type FeedbackTransaction } from './writes.ts'

type WriteRequest = {
  actorId: string
  requestId: string
  operation: string
  input: unknown
}

type WriteResult = { id: string; version?: number }

// Serialize receipt lookup, rate checks and mutation for one actor. This is a data
// consistency lock, not a role recheck; NO KEY UPDATE permits notification fanout.
export async function lockActorWrites(transaction: FeedbackTransaction, actorId: string) {
  const [actor] = await transaction
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actorId))
    .for('no key update')
  if (!actor) throw new FeedbackWriteError(401, 'Sign in to participate.')
}

function requestHash(request: WriteRequest) {
  return createHash('sha256')
    .update(JSON.stringify({ operation: request.operation, input: request.input }))
    .digest('hex')
}

// Resource ownership checks must run before replay. The actor lock protects this
// lookup until the caller writes its receipt in the same transaction.
export async function findWriteReceipt<Result extends WriteResult = { id: string }>(
  transaction: FeedbackTransaction,
  request: WriteRequest,
): Promise<Result | undefined> {
  const [receipt] = await transaction
    .select()
    .from(feedbackWriteReceipt)
    .where(
      and(
        eq(feedbackWriteReceipt.actorId, request.actorId),
        eq(feedbackWriteReceipt.requestId, request.requestId),
      ),
    )
  if (!receipt) return undefined
  if (receipt.requestHash !== requestHash(request)) {
    throw new FeedbackWriteError(409, 'This request key was already used for different content.')
  }
  return receipt.result as Result
}

export async function saveWriteReceipt<Result extends WriteResult>(
  transaction: FeedbackTransaction,
  request: WriteRequest,
  result: Result,
): Promise<Result> {
  await transaction.insert(feedbackWriteReceipt).values({
    actorId: request.actorId,
    requestId: request.requestId,
    operation: request.operation,
    requestHash: requestHash(request),
    result,
  })
  return result
}

export async function enforceWriteRate(
  transaction: FeedbackTransaction,
  request: Pick<WriteRequest, 'actorId' | 'operation'>,
  limit: { env: string; fallback: number },
) {
  const seconds = positiveInteger('FEEDBACK_PARTICIPATION_WINDOW_SECONDS', 60)
  const max = positiveInteger(limit.env, limit.fallback)
  const [recent] = await transaction
    .select({ count: count() })
    .from(feedbackWriteReceipt)
    .where(
      and(
        eq(feedbackWriteReceipt.actorId, request.actorId),
        eq(feedbackWriteReceipt.operation, request.operation),
        gte(feedbackWriteReceipt.createdAt, new Date(Date.now() - seconds * 1000)),
      ),
    )
  if (recent && recent.count >= max) {
    throw new FeedbackWriteError(429, 'Please wait before participating again.', seconds)
  }
}
