import { and, eq, isNull } from 'drizzle-orm'
import { appendEvent } from '../../../../server/events/repository.ts'
import { getDatabase } from '../../../../server/db/index.ts'
import { feedbackFollow, feedbackPost } from '../schema.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function setFollowing(actorId: string, postId: string, following: boolean) {
  return getDatabase().transaction(async (transaction) => {
    const [post] = await transaction
      .select({ id: feedbackPost.id })
      .from(feedbackPost)
      .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
      .for('no key update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')

    if (following) {
      await followPost(transaction, postId, actorId)
    } else {
      const removed = await transaction
        .delete(feedbackFollow)
        .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, actorId)))
        .returning({ postId: feedbackFollow.postId })
      if (removed.length)
        await appendEvent(transaction, { type: 'post.unfollowed', actorId, details: { postId } })
    }

    return { id: postId }
  })
}

// The owning use case supplies its transaction so post creation and following commit together.
export async function followPost(transaction: FeedbackTransaction, postId: string, userId: string) {
  const inserted = await transaction
    .insert(feedbackFollow)
    .values({ postId, userId })
    .onConflictDoNothing()
    .returning({ postId: feedbackFollow.postId })
  if (inserted.length)
    await appendEvent(transaction, { type: 'post.followed', actorId: userId, details: { postId } })
}
