import { and, eq, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import type { ReactionKind } from '../../shared/discussion/contracts.ts'
import { requirePost } from '../posts/workflow.ts'
import { feedbackPost, feedbackReaction } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'

export async function setReaction(actorId: string, postId: string, kind: ReactionKind | null) {
  return getDatabase().transaction(async (transaction) => {
    await requirePost(transaction, postId)

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

    return { id: postId }
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
