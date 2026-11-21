import { and, eq, isNull } from 'drizzle-orm'
import type { PostStatus } from '../../shared/status.ts'
import { feedbackPost } from '../schema.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

// Shared locks let comments proceed together while ordering them against moderation.
export async function requirePost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select({ id: feedbackPost.id, lockedAt: feedbackPost.lockedAt })
    .from(feedbackPost)
    .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
    .for('share')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
  requireUnlocked(post)
}

export async function lockPost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select()
    .from(feedbackPost)
    .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
    .for('no key update')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
  requireUnlocked(post)
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

function requireUnlocked(post: { lockedAt: Date | null }) {
  if (post.lockedAt) throw new FeedbackWriteError(423, 'This feedback is locked.')
}
