import { and, eq } from 'drizzle-orm'
import { appendEvent } from '../../../../server/events/repository.ts'
import { getDatabase } from '../../../../server/db/index.ts'
import type { PostEditInput } from '../../shared/posts/input.ts'
import { feedbackPost, feedbackPostTag } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { lockPost } from './workflow.ts'
import { replacePostTags } from './tags.ts'

export async function editPost(actorId: string, postId: string, input: PostEditInput) {
  return getDatabase().transaction(async (transaction) => {
    const post = await lockPost(transaction, postId)
    if (post.authorId !== actorId) {
      throw new FeedbackWriteError(403, 'Only the author can edit this feedback.')
    }
    if (post.version !== input.version) {
      throw new FeedbackWriteError(
        409,
        'This feedback has changed. Review the latest version before saving.',
      )
    }
    const currentTags = await transaction
      .select({ id: feedbackPostTag.tagId })
      .from(feedbackPostTag)
      .where(eq(feedbackPostTag.postId, postId))
    const previousTags = currentTags.map((tag) => tag.id).sort()
    const tagsChanged =
      input.tagIds !== undefined && JSON.stringify(previousTags) !== JSON.stringify(input.tagIds)
    if (
      !tagsChanged &&
      post.title === input.title &&
      post.description === input.description &&
      post.desiredImprovement === input.desiredImprovement
    ) {
      return { id: post.id, version: post.version }
    }
    if (tagsChanged) await replacePostTags(transaction, postId, input.tagIds!, previousTags)
    const now = new Date()
    const [updated] = await transaction
      .update(feedbackPost)
      .set({
        title: input.title,
        description: input.description,
        desiredImprovement: input.desiredImprovement,
        version: post.version + 1,
        editedAt: now,
        updatedAt: now,
      })
      .where(and(eq(feedbackPost.id, postId), eq(feedbackPost.version, input.version)))
      .returning({ id: feedbackPost.id, version: feedbackPost.version })
    if (!updated) throw new FeedbackWriteError(409, 'This feedback has changed.')

    const changedFields = (['title', 'description', 'desiredImprovement'] as const).filter(
      (field) => post[field] !== input[field],
    )
    await appendEvent(transaction, {
      type: 'post.edited',
      actorId,
      details: {
        postId,
        version: updated.version,
        changedFields: [...changedFields, ...(tagsChanged ? ['tagIds'] : [])],
      },
    })

    return updated
  })
}
