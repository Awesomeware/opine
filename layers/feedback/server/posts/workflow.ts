import { eq } from 'drizzle-orm'
import type { PostStatus } from '../../shared/status.ts'
import { feedbackPost } from '../schema.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function requirePost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
    .for('share')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
}

export async function lockPost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select()
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
    .for('no key update')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
  return post
}

// Callers hold the post lock and check the workflow version before coordinating changes.
export async function updatePostWorkflow(
  transaction: FeedbackTransaction,
  postId: string,
  version: number,
  change: { status: PostStatus; categoryId?: never } | { categoryId: string; status?: never },
) {
  await transaction
    .update(feedbackPost)
    .set({ ...change, workflowVersion: version, updatedAt: new Date() })
    .where(eq(feedbackPost.id, postId))
}
