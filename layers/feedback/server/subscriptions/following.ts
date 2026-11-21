import { and, eq } from 'drizzle-orm'
import { feedbackFollow, feedbackPost } from '../schema.ts'
import { feedbackWrite, FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function setFollowing(
  actorId: string,
  postId: string,
  following: boolean,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'set-following',
    { postId, following },
    async (transaction) => {
      const [post] = await transaction
        .select({ id: feedbackPost.id })
        .from(feedbackPost)
        .where(eq(feedbackPost.id, postId))
        .for('no key update')
      if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
    },
    async (transaction) => {
      if (following) await followPost(transaction, postId, actorId)
      else
        await transaction
          .delete(feedbackFollow)
          .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, actorId)))
      return { id: postId }
    },
    { env: 'FEEDBACK_FOLLOW_MAX', fallback: 30 },
  )
}

// The owning use case supplies its transaction so post creation and following commit together.
export async function followPost(transaction: FeedbackTransaction, postId: string, userId: string) {
  await transaction.insert(feedbackFollow).values({ postId, userId }).onConflictDoNothing()
}
