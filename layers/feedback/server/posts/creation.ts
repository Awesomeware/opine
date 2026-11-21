import { and, count, eq, gte } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { PostInput } from '../../shared/posts/input.ts'
import { feedbackCategory, feedbackPost } from '../schema.ts'
import { followPost } from '../subscriptions/following.ts'
import { feedbackWrite, FeedbackWriteError, positiveInteger } from '../writes.ts'
import { replacePostTags } from './tags.ts'

// The caller supplies an authenticated internal user ID and validated input.
export async function createPost(
  authorId: string,
  input: PostInput,
  requestId: string = randomUUID(),
) {
  const max = positiveInteger('FEEDBACK_POST_MAX', 5)
  const windowSeconds = positiveInteger('FEEDBACK_POST_WINDOW_SECONDS', 60)
  return feedbackWrite(
    authorId,
    requestId,
    'create-post',
    input,
    async () => {},
    async (transaction) => {
      const [recent] = await transaction
        .select({ count: count() })
        .from(feedbackPost)
        .where(
          and(
            eq(feedbackPost.authorId, authorId),
            gte(feedbackPost.createdAt, new Date(Date.now() - windowSeconds * 1000)),
          ),
        )
      if (recent && recent.count >= max)
        throw new FeedbackWriteError(
          429,
          'Please wait before submitting more feedback.',
          windowSeconds,
        )
      const [category] = await transaction
        .select({ id: feedbackCategory.id })
        .from(feedbackCategory)
        .where(and(eq(feedbackCategory.id, input.categoryId), eq(feedbackCategory.isActive, true)))
        .for('share')
      if (!category) return null
      const { tagIds, ...postInput } = input
      const [post] = await transaction
        .insert(feedbackPost)
        .values({ ...postInput, authorId })
        .returning({ id: feedbackPost.id })
      await replacePostTags(transaction, post!.id, tagIds ?? [])
      await followPost(transaction, post!.id, authorId)
      return post!
    },
  )
}
