import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import type { ContributionType } from '../../shared/discussion/contribution-types.ts'
import type { CommentEditInput, CommentInput } from '../../shared/discussion/input.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { requirePost } from '../posts/workflow.ts'
import { feedbackComment, feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import {
  enforceWriteRate,
  findWriteReceipt,
  lockActorWrites,
  saveWriteReceipt,
} from '../write-repository.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function createComment(
  actorId: string,
  postId: string,
  input: CommentInput,
  requestId: string,
) {
  return getDatabase().transaction(async (transaction) => {
    const request = { actorId, requestId, operation: 'create-comment', input: { postId, ...input } }

    await lockActorWrites(transaction, actorId)
    await requirePost(transaction, postId)

    const receipt = await findWriteReceipt<{ id: string; version: number }>(transaction, request)
    if (receipt) return receipt

    await enforceWriteRate(transaction, request, { env: 'FEEDBACK_COMMENT_MAX', fallback: 10 })

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

    return saveWriteReceipt(transaction, request, comment!)
  })
}

export async function editComment(
  actorId: string,
  postId: string,
  commentId: string,
  input: CommentEditInput,
  requestId: string,
) {
  const where = and(eq(feedbackComment.postId, postId), eq(feedbackComment.id, commentId))
  return getDatabase().transaction(async (transaction) => {
    const request = {
      actorId,
      requestId,
      operation: 'edit-comment',
      input: { postId, commentId, ...input },
    }

    await lockActorWrites(transaction, actorId)
    const [ownedComment] = await transaction
      .select({ authorId: feedbackComment.authorId })
      .from(feedbackComment)
      .where(where)
    if (!ownedComment) throw new FeedbackWriteError(404, 'Comment not found.')
    if (ownedComment.authorId !== actorId) {
      throw new FeedbackWriteError(403, 'Only the author can edit this comment.')
    }

    const receipt = await findWriteReceipt<{ id: string; version: number }>(transaction, request)
    if (receipt) return receipt

    await enforceWriteRate(transaction, request, { env: 'FEEDBACK_EDIT_MAX', fallback: 20 })

    const [comment] = await transaction.select().from(feedbackComment).where(where).for('update')
    if (!comment) throw new FeedbackWriteError(404, 'Comment not found.')
    if (comment.version !== input.version) {
      throw new FeedbackWriteError(
        409,
        'This comment has changed. Review the latest version before saving.',
      )
    }
    const type = input.type ?? comment.type
    if (comment.body === input.body && comment.type === type) {
      return saveWriteReceipt(transaction, request, { id: comment.id, version: comment.version })
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

    return saveWriteReceipt(transaction, request, updated)
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
      ? sql<boolean>`${feedbackComment.authorId} = ${viewerId}`
      : sql<boolean>`false`,
  }
}

export async function getComment(postId: string, commentId: string, viewerId?: string) {
  const [comment] = await getDatabase()
    .select(commentFields(viewerId))
    .from(feedbackComment)
    .innerJoin(user, eq(user.id, feedbackComment.authorId))
    .where(and(eq(feedbackComment.postId, postId), eq(feedbackComment.id, commentId)))
    .limit(1)
  return comment
}

export async function listComments(
  postId: string,
  {
    cursor,
    limit = 20,
    type,
  }: { cursor?: PostCursor; limit?: number; type?: ContributionType } = {},
  viewerId?: string,
  database: Pick<FeedbackTransaction, 'select'> = getDatabase(),
) {
  const posts = await database
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
  if (!posts.length) throw new FeedbackWriteError(404, 'Feedback not found.')
  const comments = await database
    .select(commentFields(viewerId))
    .from(feedbackComment)
    .innerJoin(user, eq(user.id, feedbackComment.authorId))
    .where(
      and(
        eq(feedbackComment.postId, postId),
        type ? eq(feedbackComment.type, type) : undefined,
        cursor
          ? or(
              gt(feedbackComment.createdAt, new Date(cursor.createdAt)),
              and(
                eq(feedbackComment.createdAt, new Date(cursor.createdAt)),
                gt(feedbackComment.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(feedbackComment.createdAt), asc(feedbackComment.id))
    .limit(limit + 1)
  const page = comments.slice(0, limit)
  const last = page.at(-1)
  return {
    comments: page,
    nextCursor: cursorFor(last, comments.length > limit),
  }
}
