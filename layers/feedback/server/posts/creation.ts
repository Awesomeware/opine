import { and, count, eq, gte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../../../../server/db/index.ts'
import type { PostInput } from '../../shared/posts/input.ts'
import { feedbackPost } from '../schema.ts'
import { followPost } from '../subscriptions/following.ts'
import { findWriteReceipt, lockActorWrites, saveWriteReceipt } from '../write-repository.ts'
import { FeedbackWriteError, positiveInteger, type FeedbackTransaction } from '../writes.ts'
import { findActiveCategory } from './categories.ts'
import { replacePostTags } from './tags.ts'

// The caller supplies an authenticated internal user ID and validated input.
export async function createPost(
  authorId: string,
  input: PostInput,
  requestId: string = randomUUID(),
) {
  return getDatabase().transaction(async (transaction) => {
    const request = { actorId: authorId, requestId, operation: 'create-post', input }

    await lockActorWrites(transaction, authorId)

    const receipt = await findWriteReceipt(transaction, request)
    if (receipt) return receipt

    await enforcePostLimit(transaction, authorId)

    const category = await findActiveCategory(transaction, input.categoryId)
    if (!category) return null

    const { tagIds, ...postInput } = input
    const [post] = await transaction
      .insert(feedbackPost)
      .values({ ...postInput, authorId })
      .returning({ id: feedbackPost.id })

    await replacePostTags(transaction, post!.id, tagIds ?? [])
    await followPost(transaction, post!.id, authorId)

    return saveWriteReceipt(transaction, request, post!)
  })
}

async function enforcePostLimit(transaction: FeedbackTransaction, authorId: string) {
  const max = positiveInteger('FEEDBACK_POST_MAX', 5)
  const windowSeconds = positiveInteger('FEEDBACK_POST_WINDOW_SECONDS', 60)
  const [recent] = await transaction
    .select({ count: count() })
    .from(feedbackPost)
    .where(
      and(
        eq(feedbackPost.authorId, authorId),
        gte(feedbackPost.createdAt, new Date(Date.now() - windowSeconds * 1000)),
      ),
    )
  if (recent && recent.count >= max) {
    throw new FeedbackWriteError(429, 'Please wait before submitting more feedback.', windowSeconds)
  }
}
