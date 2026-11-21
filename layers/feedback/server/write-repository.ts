import { and, count, eq, gte } from 'drizzle-orm'
import { user } from '../../auth/server/schema.ts'
import { feedbackComment, feedbackOfficialResponse } from './schema.ts'
import { FeedbackWriteError, positiveInteger, type FeedbackTransaction } from './writes.ts'

// Serialize creation limits for an actor; NO KEY UPDATE permits notification fanout.
export async function lockActorCreations(transaction: FeedbackTransaction, actorId: string) {
  const [actor] = await transaction
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, actorId))
    .for('no key update')
  if (!actor) throw new FeedbackWriteError(401, 'Sign in to participate.')
}

export async function enforceContributionLimit(
  transaction: FeedbackTransaction,
  actorId: string,
  table: typeof feedbackComment | typeof feedbackOfficialResponse,
  limit: { env: string; fallback: number },
) {
  const seconds = positiveInteger('FEEDBACK_PARTICIPATION_WINDOW_SECONDS', 60)
  const maximum = positiveInteger(limit.env, limit.fallback)
  const [recent] = await transaction
    .select({ count: count() })
    .from(table)
    .where(
      and(eq(table.authorId, actorId), gte(table.createdAt, new Date(Date.now() - seconds * 1000))),
    )
  if (recent && recent.count >= maximum) {
    throw new FeedbackWriteError(429, 'Please wait before participating again.', seconds)
  }
}
