import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { feedbackFollow, feedbackPost } from '../schema.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function setFollowing(actorId: string, postId: string, following: boolean) {
  return getDatabase().transaction(async (transaction) => {
    const [post] = await transaction
      .select({ id: feedbackPost.id })
      .from(feedbackPost)
      .where(eq(feedbackPost.id, postId))
      .for('no key update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')

    if (following) {
      await followPost(transaction, postId, actorId)
    } else {
      await transaction
        .delete(feedbackFollow)
        .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, actorId)))
    }

    return { id: postId }
  })
}

// The owning use case supplies its transaction so post creation and following commit together.
export async function followPost(transaction: FeedbackTransaction, postId: string, userId: string) {
  await transaction.insert(feedbackFollow).values({ postId, userId }).onConflictDoNothing()
}
