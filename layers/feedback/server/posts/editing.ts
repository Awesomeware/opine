import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import type { PostEditInput } from '../../shared/posts/input.ts'
import { feedbackPost, feedbackPostTag } from '../schema.ts'
import {
  enforceWriteRate,
  findWriteReceipt,
  lockActorWrites,
  saveWriteReceipt,
} from '../write-repository.ts'
import { FeedbackWriteError } from '../writes.ts'
import { replacePostTags } from './tags.ts'

export async function editPost(
  actorId: string,
  postId: string,
  input: PostEditInput,
  requestId: string,
) {
  return getDatabase().transaction(async (transaction) => {
    const request = { actorId, requestId, operation: 'edit-post', input: { postId, ...input } }

    await lockActorWrites(transaction, actorId)
    const [ownedPost] = await transaction
      .select({ authorId: feedbackPost.authorId })
      .from(feedbackPost)
      .where(eq(feedbackPost.id, postId))
    if (!ownedPost) throw new FeedbackWriteError(404, 'Feedback not found.')
    if (ownedPost.authorId !== actorId) {
      throw new FeedbackWriteError(403, 'Only the author can edit this feedback.')
    }

    const receipt = await findWriteReceipt<{ id: string; version: number }>(transaction, request)
    if (receipt) return receipt

    await enforceWriteRate(transaction, request, { env: 'FEEDBACK_EDIT_MAX', fallback: 20 })

    const [post] = await transaction
      .select()
      .from(feedbackPost)
      .where(eq(feedbackPost.id, postId))
      .for('update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
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
      return saveWriteReceipt(transaction, request, { id: post.id, version: post.version })
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

    return saveWriteReceipt(transaction, request, updated)
  })
}
