import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { appendEvent } from '../../../../server/events/repository.ts'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import type { ContributionType } from '../../shared/discussion/contribution-types.ts'
import type { CommentEditInput, CommentInput } from '../../shared/discussion/input.ts'
import {
  cursorCondition,
  defaultPageSize,
  paginateRows,
  type Pagination,
} from '../../../../server/pagination.ts'
import { requirePost } from '../posts/workflow.ts'
import { feedbackComment, feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import { lockActorCreations, enforceContributionLimit } from '../write-repository.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function createComment(actorId: string, postId: string, input: CommentInput) {
  return getDatabase().transaction(async (transaction) => {
    await lockActorCreations(transaction, actorId)
    await requirePost(transaction, postId)

    await enforceContributionLimit(transaction, actorId, feedbackComment, {
      env: 'FEEDBACK_COMMENT_MAX',
      fallback: 10,
    })

    const [comment] = await transaction
      .insert(feedbackComment)
      .values({
        postId,
        authorId: actorId,
        body: input.body,
        type: input.type,
        // A waiting transaction must appear after the response it follows.
        createdAt: sql`greatest(clock_timestamp(), coalesce((select max(created_at) + interval '1 millisecond' from ${feedbackOfficialResponse} where post_id = ${postId}::uuid), clock_timestamp()))`,
      })
      .returning({ id: feedbackComment.id, version: feedbackComment.version })

    await appendEvent(transaction, {
      type: 'comment.created',
      actorId,
      details: { postId, commentId: comment!.id, version: comment!.version },
    })
    return comment!
  })
}

export async function editComment(
  actorId: string,
  postId: string,
  commentId: string,
  input: CommentEditInput,
) {
  const where = and(eq(feedbackComment.postId, postId), eq(feedbackComment.id, commentId))
  return getDatabase().transaction(async (transaction) => {
    await requirePost(transaction, postId)

    const [comment] = await transaction.select().from(feedbackComment).where(where).for('update')
    if (!comment) throw new FeedbackWriteError(404, 'Comment not found.')
    if (comment.authorId !== actorId) {
      throw new FeedbackWriteError(403, 'Only the author can edit this comment.')
    }
    if (comment.version !== input.version) {
      throw new FeedbackWriteError(
        409,
        'This comment has changed. Review the latest version before saving.',
      )
    }
    const type = input.type ?? comment.type
    if (comment.body === input.body && comment.type === type) {
      return { id: comment.id, version: comment.version }
    }
    const [updated] = await transaction
      .update(feedbackComment)
      .set({
        body: input.body,
        type,
        version: comment.version + 1,
        editedAt: new Date(),
      })
      .where(and(where, eq(feedbackComment.version, input.version)))
      .returning({ id: feedbackComment.id, version: feedbackComment.version })
    if (!updated) throw new FeedbackWriteError(409, 'This comment has changed.')

    const changedFields = [
      ...(comment.body !== input.body ? ['body'] : []),
      ...(comment.type !== type ? ['type'] : []),
    ]
    await appendEvent(transaction, {
      type: 'comment.edited',
      actorId,
      details: { postId, commentId, version: updated.version, changedFields },
    })
    return updated
  })
}

function commentFields(viewerId?: string) {
  return {
    id: feedbackComment.id,
    postId: feedbackComment.postId,
    body: feedbackComment.body,
    type: feedbackComment.type,
    createdAt: feedbackComment.createdAt,
    editedAt: feedbackComment.editedAt,
    version: feedbackComment.version,
    author: { name: user.name },
    canEdit: viewerId
      ? sql<boolean>`${feedbackComment.authorId} = ${viewerId} and ${feedbackPost.lockedAt} is null`
      : sql<boolean>`false`,
  }
}

export async function getComment(postId: string, commentId: string, viewerId?: string) {
  const [comment] = await getDatabase()
    .select(commentFields(viewerId))
    .from(feedbackComment)
    .innerJoin(user, eq(user.id, feedbackComment.authorId))
    .innerJoin(feedbackPost, eq(feedbackPost.id, feedbackComment.postId))
    .where(
      and(
        eq(feedbackComment.postId, postId),
        eq(feedbackComment.id, commentId),
        isNull(feedbackPost.archivedAt),
      ),
    )
    .limit(1)
  return comment
}

export async function listComments(
  postId: string,
  { cursor, limit = defaultPageSize, type }: Pagination & { type?: ContributionType } = {},
  viewerId?: string,
  database: Pick<FeedbackTransaction, 'select'> = getDatabase(),
) {
  const posts = await database
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
  if (!posts.length) throw new FeedbackWriteError(404, 'Feedback not found.')
  const rows = await database
    .select(commentFields(viewerId))
    .from(feedbackComment)
    .innerJoin(user, eq(user.id, feedbackComment.authorId))
    .innerJoin(feedbackPost, eq(feedbackPost.id, feedbackComment.postId))
    .where(
      and(
        eq(feedbackComment.postId, postId),
        isNull(feedbackPost.archivedAt),
        type ? eq(feedbackComment.type, type) : undefined,
        cursorCondition(feedbackComment, cursor, 'asc'),
      ),
    )
    .orderBy(asc(feedbackComment.createdAt), asc(feedbackComment.id))
    .limit(limit + 1)
  const { items: comments, nextCursor } = paginateRows(rows, limit)
  return { comments, nextCursor }
}
