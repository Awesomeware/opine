import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { feedbackFollow, feedbackPost } from '../schema.ts'
import {
  enforceWriteRate,
  findWriteReceipt,
  lockActorWrites,
  saveWriteReceipt,
} from '../write-repository.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function setFollowing(
  actorId: string,
  postId: string,
  following: boolean,
  requestId: string,
) {
  return getDatabase().transaction(async (transaction) => {
    const request = { actorId, requestId, operation: 'set-following', input: { postId, following } }

    await lockActorWrites(transaction, actorId)
    const [post] = await transaction
      .select({ id: feedbackPost.id })
      .from(feedbackPost)
      .where(eq(feedbackPost.id, postId))
      .for('no key update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')

    const receipt = await findWriteReceipt(transaction, request)
    if (receipt) return receipt

    await enforceWriteRate(transaction, request, { env: 'FEEDBACK_FOLLOW_MAX', fallback: 30 })

    if (following) {
      await followPost(transaction, postId, actorId)
    } else {
      await transaction
        .delete(feedbackFollow)
        .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, actorId)))
    }

    return saveWriteReceipt(transaction, request, { id: postId })
  })
}

// The owning use case supplies its transaction so post creation and following commit together.
export async function followPost(transaction: FeedbackTransaction, postId: string, userId: string) {
  await transaction.insert(feedbackFollow).values({ postId, userId }).onConflictDoNothing()
}
