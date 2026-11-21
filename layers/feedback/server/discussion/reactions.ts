import { and, eq, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import type { ReactionKind } from '../../shared/discussion/contracts.ts'
import { requirePost } from '../posts/workflow.ts'
import { feedbackPost, feedbackReaction } from '../schema.ts'
import {
  enforceWriteRate,
  findWriteReceipt,
  lockActorWrites,
  saveWriteReceipt,
} from '../write-repository.ts'
import { FeedbackWriteError } from '../writes.ts'

export async function setReaction(
  actorId: string,
  postId: string,
  kind: ReactionKind | null,
  requestId: string,
) {
  return getDatabase().transaction(async (transaction) => {
    const request = { actorId, requestId, operation: 'set-reaction', input: { postId, kind } }

    await lockActorWrites(transaction, actorId)
    await requirePost(transaction, postId)

    const receipt = await findWriteReceipt(transaction, request)
    if (receipt) return receipt

    await enforceWriteRate(transaction, request, { env: 'FEEDBACK_REACTION_MAX', fallback: 30 })

    if (kind === null) {
      await transaction
        .delete(feedbackReaction)
        .where(and(eq(feedbackReaction.postId, postId), eq(feedbackReaction.userId, actorId)))
    } else {
      await transaction
        .insert(feedbackReaction)
        .values({ postId, userId: actorId, kind })
        .onConflictDoUpdate({
          target: [feedbackReaction.postId, feedbackReaction.userId],
          set: { kind, updatedAt: new Date() },
        })
    }

    return saveWriteReceipt(transaction, request, { id: postId })
  })
}

export async function getReactions(postId: string, viewerId?: string) {
  // Counts and the viewer's choice must describe the same committed state.
  const [reactions] = await getDatabase()
    .select({
      agree: sql`count(*) filter (where ${feedbackReaction.kind} = 'agree')`.mapWith(Number),
      disagree: sql`count(*) filter (where ${feedbackReaction.kind} = 'disagree')`.mapWith(Number),
      mine: viewerId
        ? sql<ReactionKind | null>`max(case when ${feedbackReaction.userId} = ${viewerId} then ${feedbackReaction.kind}::text end)`
        : sql<null>`null`,
    })
    .from(feedbackPost)
    .leftJoin(feedbackReaction, eq(feedbackReaction.postId, feedbackPost.id))
    .where(eq(feedbackPost.id, postId))
    .groupBy(feedbackPost.id)
  if (!reactions) throw new FeedbackWriteError(404, 'Feedback not found.')
  return reactions
}
