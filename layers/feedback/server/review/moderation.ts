import { and, eq, isNull } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { appendEvent } from '../../../../server/events/repository.ts'
import { feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'

export async function setPostLocked(actorId: string, postId: string, locked: boolean) {
  return getDatabase().transaction(async (transaction) => {
    const [post] = await transaction
      .select()
      .from(feedbackPost)
      .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
      .for('no key update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
    const canEdit = post.authorId === actorId && !locked
    if (Boolean(post.lockedAt) === locked) return { lockedAt: post.lockedAt, canEdit }

    const lockedAt = locked ? new Date() : null
    await transaction.update(feedbackPost).set({ lockedAt }).where(eq(feedbackPost.id, postId))
    await appendEvent(transaction, {
      type: locked ? 'post.locked' : 'post.unlocked',
      actorId,
      details: { postId },
    })
    return { lockedAt, canEdit }
  })
}

export async function archivePost(actorId: string, postId: string) {
  return getDatabase().transaction(async (transaction) => {
    const [post] = await transaction
      .select({ id: feedbackPost.id })
      .from(feedbackPost)
      .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
      .for('no key update')
    if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')

    await transaction
      .update(feedbackPost)
      .set({ archivedAt: new Date() })
      .where(eq(feedbackPost.id, postId))
    await appendEvent(transaction, { type: 'post.archived', actorId, details: { postId } })
    return { archived: true as const }
  })
}
