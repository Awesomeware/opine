import { and, desc, eq, gte } from 'drizzle-orm'
import { appendEvent } from '../../../../server/events/repository.ts'
import { getDatabase } from '../../../../server/db/index.ts'
import type { PostInput } from '../../shared/posts/input.ts'
import { feedbackPost } from '../schema.ts'
import { lockActorCreations } from '../write-repository.ts'
import { followPost } from '../subscriptions/following.ts'
import { FeedbackWriteError, positiveInteger, type FeedbackTransaction } from '../writes.ts'
import { findActiveCategory } from './categories.ts'
import { replacePostTags } from './tags.ts'

// The caller supplies an authenticated internal user ID and validated input.
export async function createPost(authorId: string, input: PostInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockActorCreations(transaction, authorId)

    const category = await findActiveCategory(transaction, input.categoryId)
    if (!category) return null

    await enforcePostLimit(transaction, authorId)

    const { tagIds, ...postInput } = input
    const createdAt = new Date()
    const [post] = await transaction
      .insert(feedbackPost)
      .values({ ...postInput, authorId, createdAt, updatedAt: createdAt })
      .returning({ id: feedbackPost.id })

    await replacePostTags(transaction, post!.id, tagIds ?? [])
    await appendEvent(transaction, {
      type: 'post.created',
      actorId: authorId,
      details: { postId: post!.id },
    })
    await followPost(transaction, post!.id, authorId)

    return post!
  })
}

async function enforcePostLimit(transaction: FeedbackTransaction, authorId: string) {
  const windowSeconds = positiveInteger('FEEDBACK_POST_WINDOW_SECONDS', 60)
  const [recent] = await transaction
    .select({ createdAt: feedbackPost.createdAt })
    .from(feedbackPost)
    .where(
      and(
        eq(feedbackPost.authorId, authorId),
        gte(feedbackPost.createdAt, new Date(Date.now() - windowSeconds * 1000)),
      ),
    )
    .orderBy(desc(feedbackPost.createdAt))
    .limit(1)
  if (recent) {
    const remainingSeconds = Math.max(
      1,
      Math.ceil((recent.createdAt.getTime() + windowSeconds * 1000 - Date.now()) / 1000),
    )
    throw new FeedbackWriteError(
      429,
      'Please wait before submitting more feedback.',
      remainingSeconds,
    )
  }
}
