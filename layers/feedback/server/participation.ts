import { and, asc, count, eq, gt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import type { ReactionKind } from '../shared/contracts.ts'
import type { ContributionType } from '../shared/contribution-types.ts'
import type {
  CommentInput,
  CommentEditInput,
  PostEditInput,
} from '../shared/participation-input.ts'
import type { PostCursor } from './list-input.ts'
import {
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
  feedbackReaction,
} from './schema.ts'
import { replacePostTags } from './tags.ts'
import { feedbackPostTag } from './schema.ts'
import { feedbackWrite, FeedbackWriteError, type FeedbackTransaction } from './writes.ts'

async function requirePost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
    .for('share')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
}
export async function createComment(
  actorId: string,
  postId: string,
  input: CommentInput,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'create-comment',
    { postId, ...input },
    (transaction) => requirePost(transaction, postId),
    async (transaction) => {
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
      return comment!
    },
    { env: 'FEEDBACK_COMMENT_MAX', fallback: 10 },
  )
}
// This path can only recover an already committed pre-types write, never create a comment.
export async function replayLegacyComment(
  actorId: string,
  postId: string,
  input: { body: string },
  requestId: string,
) {
  return feedbackWrite<{ id: string; version: number } | null>(
    actorId,
    requestId,
    'create-comment',
    { postId, ...input },
    (transaction) => requirePost(transaction, postId),
    async () => null,
  )
}
export async function editPost(
  actorId: string,
  postId: string,
  input: PostEditInput,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'edit-post',
    { postId, ...input },
    async (transaction) => {
      const [post] = await transaction
        .select({ authorId: feedbackPost.authorId })
        .from(feedbackPost)
        .where(eq(feedbackPost.id, postId))
      if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
      if (post.authorId !== actorId)
        throw new FeedbackWriteError(403, 'Only the author can edit this feedback.')
    },
    async (transaction) => {
      const [post] = await transaction
        .select()
        .from(feedbackPost)
        .where(eq(feedbackPost.id, postId))
        .for('update')
      if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
      if (post.version !== input.version)
        throw new FeedbackWriteError(
          409,
          'This feedback has changed. Review the latest version before saving.',
        )
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
      )
        return { id: post.id, version: post.version }
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
      return updated
    },
    { env: 'FEEDBACK_EDIT_MAX', fallback: 20 },
  )
}
export async function editComment(
  actorId: string,
  postId: string,
  commentId: string,
  input: CommentEditInput,
  requestId: string,
) {
  const where = and(eq(feedbackComment.postId, postId), eq(feedbackComment.id, commentId))
  return feedbackWrite(
    actorId,
    requestId,
    'edit-comment',
    { postId, commentId, ...input },
    async (transaction) => {
      const [comment] = await transaction
        .select({ authorId: feedbackComment.authorId })
        .from(feedbackComment)
        .where(where)
      if (!comment) throw new FeedbackWriteError(404, 'Comment not found.')
      if (comment.authorId !== actorId)
        throw new FeedbackWriteError(403, 'Only the author can edit this comment.')
    },
    async (transaction) => {
      const [comment] = await transaction.select().from(feedbackComment).where(where).for('update')
      if (!comment) throw new FeedbackWriteError(404, 'Comment not found.')
      if (comment.version !== input.version)
        throw new FeedbackWriteError(
          409,
          'This comment has changed. Review the latest version before saving.',
        )
      const type = input.type ?? comment.type
      if (comment.body === input.body && comment.type === type)
        return { id: comment.id, version: comment.version }
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
      return updated
    },
    { env: 'FEEDBACK_EDIT_MAX', fallback: 20 },
  )
}
export async function setReaction(
  actorId: string,
  postId: string,
  kind: ReactionKind | null,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'set-reaction',
    { postId, kind },
    (transaction) => requirePost(transaction, postId),
    async (transaction) => {
      if (kind === null)
        await transaction
          .delete(feedbackReaction)
          .where(and(eq(feedbackReaction.postId, postId), eq(feedbackReaction.userId, actorId)))
      else
        await transaction
          .insert(feedbackReaction)
          .values({ postId, userId: actorId, kind })
          .onConflictDoUpdate({
            target: [feedbackReaction.postId, feedbackReaction.userId],
            set: { kind, updatedAt: new Date() },
          })
      return { id: postId }
    },
    { env: 'FEEDBACK_REACTION_MAX', fallback: 30 },
  )
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
) {
  const posts = await getDatabase()
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
  if (!posts.length) throw new FeedbackWriteError(404, 'Feedback not found.')
  const comments = await getDatabase()
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
    nextCursor:
      comments.length > limit && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
          ).toString('base64url')
        : null,
  }
}
export async function getReactions(postId: string, viewerId?: string) {
  const posts = await getDatabase()
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
  if (!posts.length) throw new FeedbackWriteError(404, 'Feedback not found.')
  const groups = await getDatabase()
    .select({ kind: feedbackReaction.kind, count: count() })
    .from(feedbackReaction)
    .where(eq(feedbackReaction.postId, postId))
    .groupBy(feedbackReaction.kind)
  const mine = viewerId
    ? await getDatabase()
        .select({ kind: feedbackReaction.kind })
        .from(feedbackReaction)
        .where(and(eq(feedbackReaction.postId, postId), eq(feedbackReaction.userId, viewerId)))
    : []
  return {
    agree: groups.find((row) => row.kind === 'agree')?.count ?? 0,
    disagree: groups.find((row) => row.kind === 'disagree')?.count ?? 0,
    mine: mine[0]?.kind ?? null,
  }
}
