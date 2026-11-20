import { and, asc, count, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user, userRole } from '../../auth/server/schema.ts'
import type { OfficialResponseInput, CategoryCorrectionInput } from '../shared/outcome-input.ts'
import type { ContributionType } from '../shared/contribution-types.ts'
import type { PostStatus } from '../shared/status.ts'
import { cursorFor, type PostCursor } from './list-input.ts'
import { publicPostFields } from './posts.ts'
import { listComments } from './participation.ts'
import {
  feedbackCategory,
  feedbackCategoryChange,
  feedbackComment,
  feedbackFollow,
  feedbackNotification,
  feedbackOfficialResponse,
  feedbackPost,
} from './schema.ts'
import { feedbackWrite, FeedbackWriteError, type FeedbackTransaction } from './writes.ts'

type Pagination = { cursor?: PostCursor; limit?: number }
const responseFields = {
  id: feedbackOfficialResponse.id,
  postId: feedbackOfficialResponse.postId,
  body: feedbackOfficialResponse.body,
  author: { name: user.name },
  createdAt: feedbackOfficialResponse.createdAt,
  previousStatus: feedbackOfficialResponse.previousStatus,
  status: feedbackOfficialResponse.status,
}
async function requireManager(
  actorId: string,
  database: Pick<FeedbackTransaction, 'select'> = getDatabase(),
) {
  const [role] = await database
    .select({ role: userRole.role })
    .from(userRole)
    .where(and(eq(userRole.userId, actorId), eq(userRole.role, 'community-manager')))
  if (!role) throw new FeedbackWriteError(403, 'Community-manager access is required.')
}
async function lockPost(transaction: FeedbackTransaction, postId: string) {
  const [post] = await transaction
    .select()
    .from(feedbackPost)
    .where(eq(feedbackPost.id, postId))
    .for('no key update')
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
  return post
}
function checkVersion(actual: number, supplied: number) {
  if (actual !== supplied)
    throw new FeedbackWriteError(
      409,
      'The official workflow has changed. Review the latest response and status before saving.',
    )
}
export async function publishResponse(
  actorId: string,
  postId: string,
  input: OfficialResponseInput,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'publish-response',
    { postId, ...input },
    (transaction) => requireManager(actorId, transaction),
    async (transaction) => {
      const post = await lockPost(transaction, postId)
      checkVersion(post.workflowVersion, input.version)
      const [latest] = await transaction
        .select({ createdAt: feedbackOfficialResponse.createdAt })
        .from(feedbackOfficialResponse)
        .where(eq(feedbackOfficialResponse.postId, postId))
        .orderBy(desc(feedbackOfficialResponse.createdAt))
        .limit(1)
      const [latestComment] = await transaction
        .select({ createdAt: feedbackComment.createdAt })
        .from(feedbackComment)
        .where(eq(feedbackComment.postId, postId))
        .orderBy(desc(feedbackComment.createdAt))
        .limit(1)
      // The post lock orders publication after prior comments, including rounded timestamps.
      const createdAt = new Date(
        Math.max(
          Date.now(),
          (latest?.createdAt.getTime() ?? 0) + 1,
          (latestComment?.createdAt.getTime() ?? 0) + 1,
        ),
      )
      const changed = input.status !== undefined && input.status !== post.status
      const [response] = await transaction
        .insert(feedbackOfficialResponse)
        .values({
          postId,
          authorId: actorId,
          body: input.body,
          createdAt,
          previousStatus: changed ? post.status : null,
          status: changed ? input.status : null,
        })
        .returning({ id: feedbackOfficialResponse.id })
      const version = post.workflowVersion + 1
      await transaction
        .update(feedbackPost)
        .set({
          workflowVersion: version,
          status: input.status ?? post.status,
          updatedAt: new Date(),
        })
        .where(eq(feedbackPost.id, postId))
      // A single INSERT ... SELECT keeps fanout atomic without loading the follower list.
      await transaction.execute(sql`
        insert into ${feedbackNotification} (user_id, response_id, created_at)
        select ${feedbackFollow.userId}, ${response!.id}::uuid, ${createdAt.toISOString()}::timestamptz
        from ${feedbackFollow}
        where ${feedbackFollow.postId} = ${postId}::uuid
      `)
      return { id: response!.id, version }
    },
    { env: 'FEEDBACK_RESPONSE_MAX', fallback: 20 },
  )
}
export async function getOfficialResponse(postId: string, responseId: string) {
  const [response] = await getDatabase()
    .select(responseFields)
    .from(feedbackOfficialResponse)
    .innerJoin(user, eq(user.id, feedbackOfficialResponse.authorId))
    .where(
      and(eq(feedbackOfficialResponse.postId, postId), eq(feedbackOfficialResponse.id, responseId)),
    )
  return response
}
export async function getOutcome(postId: string, viewerId?: string) {
  return getDatabase().transaction(
    async (db) => {
      const [post] = await db
        .select({ status: feedbackPost.status, version: feedbackPost.workflowVersion })
        .from(feedbackPost)
        .where(eq(feedbackPost.id, postId))
      if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
      const responses = (statusOnly: boolean) =>
        db
          .select(responseFields)
          .from(feedbackOfficialResponse)
          .innerJoin(user, eq(user.id, feedbackOfficialResponse.authorId))
          .where(
            and(
              eq(feedbackOfficialResponse.postId, postId),
              statusOnly ? isNotNull(feedbackOfficialResponse.status) : undefined,
            ),
          )
          .orderBy(desc(feedbackOfficialResponse.createdAt), desc(feedbackOfficialResponse.id))
          .limit(1)
      const latest = await responses(false)
      const status = await responses(true)
      const follow = viewerId
        ? await db
            .select({ id: feedbackFollow.userId })
            .from(feedbackFollow)
            .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, viewerId)))
        : []
      const roles = viewerId
        ? await db
            .select({ role: userRole.role })
            .from(userRole)
            .where(and(eq(userRole.userId, viewerId), eq(userRole.role, 'community-manager')))
        : []
      return {
        ...post,
        latestResponse: latest[0] ?? null,
        statusResponse: status[0] ?? null,
        following: follow.length > 0,
        canRespond: roles.length > 0,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
export async function setFollowing(
  actorId: string,
  postId: string,
  following: boolean,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'set-following',
    { postId, following },
    async (transaction) => {
      await lockPost(transaction, postId)
    },
    async (transaction) => {
      if (following)
        await transaction
          .insert(feedbackFollow)
          .values({ postId, userId: actorId })
          .onConflictDoNothing()
      else
        await transaction
          .delete(feedbackFollow)
          .where(and(eq(feedbackFollow.postId, postId), eq(feedbackFollow.userId, actorId)))
      return { id: postId }
    },
    { env: 'FEEDBACK_FOLLOW_MAX', fallback: 30 },
  )
}
export async function correctCategory(
  actorId: string,
  postId: string,
  input: CategoryCorrectionInput,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'correct-category',
    { postId, ...input },
    (transaction) => requireManager(actorId, transaction),
    async (transaction) => {
      const post = await lockPost(transaction, postId)
      checkVersion(post.workflowVersion, input.version)
      const [category] = await transaction
        .select({ id: feedbackCategory.id })
        .from(feedbackCategory)
        .where(and(eq(feedbackCategory.id, input.categoryId), eq(feedbackCategory.isActive, true)))
        .for('share')
      if (!category) throw new FeedbackWriteError(400, 'Choose an active category.')
      if (post.categoryId === input.categoryId) return { id: postId, version: post.workflowVersion }
      await transaction.insert(feedbackCategoryChange).values({
        postId,
        actorId,
        previousCategoryId: post.categoryId,
        categoryId: input.categoryId,
      })
      await transaction
        .update(feedbackPost)
        .set({
          categoryId: input.categoryId,
          workflowVersion: post.workflowVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(feedbackPost.id, postId))
      return { id: postId, version: post.workflowVersion + 1 }
    },
  )
}
export async function listCategoryHistory(
  actorId: string,
  postId: string,
  { cursor, limit = 20 }: Pagination = {},
) {
  await requireManager(actorId)
  const t = feedbackCategoryChange
  const rows = await getDatabase()
    .select({
      id: t.id,
      previousCategoryId: t.previousCategoryId,
      categoryId: t.categoryId,
      actor: { name: user.name },
      createdAt: t.createdAt,
    })
    .from(t)
    .innerJoin(user, eq(user.id, t.actorId))
    .where(
      and(
        eq(t.postId, postId),
        cursor
          ? or(
              gt(t.createdAt, new Date(cursor.createdAt)),
              and(eq(t.createdAt, new Date(cursor.createdAt)), gt(t.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(t.createdAt), asc(t.id))
    .limit(limit + 1)
  const changes = rows.slice(0, limit)
  return { changes, nextCursor: cursorFor(changes.at(-1), rows.length > limit) }
}
export async function listDiscussion(
  postId: string,
  { cursor, limit = 20, type }: Pagination & { type?: ContributionType | 'team' } = {},
  viewerId?: string,
) {
  // A cursor must not advance past comments committed between the two source reads.
  return getDatabase().transaction(
    async (db) => {
      // Both sources are bounded before the merge; fetching limit+1 from each is sufficient.
      const comments =
        type === 'team'
          ? []
          : (await listComments(postId, { cursor, limit: limit + 1, type }, viewerId, db)).comments
      if (type === 'team') {
        const [post] = await db
          .select({ id: feedbackPost.id })
          .from(feedbackPost)
          .where(eq(feedbackPost.id, postId))
        if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')
      }
      const t = feedbackOfficialResponse
      const responses =
        !type || type === 'team'
          ? await db
              .select(responseFields)
              .from(t)
              .innerJoin(user, eq(user.id, t.authorId))
              .where(
                and(
                  eq(t.postId, postId),
                  cursor
                    ? or(
                        gt(t.createdAt, new Date(cursor.createdAt)),
                        and(eq(t.createdAt, new Date(cursor.createdAt)), gt(t.id, cursor.id)),
                      )
                    : undefined,
                ),
              )
              .orderBy(asc(t.createdAt), asc(t.id))
              .limit(limit + 1)
          : []
      const merged = [
        ...comments.map((comment) => ({ kind: 'comment' as const, comment, row: comment })),
        ...responses.map((response) => ({ kind: 'response' as const, response, row: response })),
      ].sort(
        (a, b) =>
          a.row.createdAt.getTime() - b.row.createdAt.getTime() || a.row.id.localeCompare(b.row.id),
      )
      const page = merged.slice(0, limit)
      return {
        entries: page.map(({ row: _row, ...entry }) => entry),
        nextCursor: cursorFor(page.at(-1)?.row, merged.length > limit),
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}

export async function listReviewQueue(
  actorId: string,
  {
    status = 'new',
    category,
    followUp,
    cursor,
    limit = 20,
  }: Pagination & { status?: PostStatus | 'all'; category?: string; followUp?: boolean } = {},
) {
  await requireManager(actorId)
  const t = feedbackPost
  const rows = await getDatabase()
    .select({
      ...publicPostFields,
      excerpt: sql<string>`left(${t.description}, 240)`,
    })
    .from(t)
    .innerJoin(user, eq(user.id, t.authorId))
    .innerJoin(feedbackCategory, eq(feedbackCategory.id, t.categoryId))
    .where(
      and(
        status !== 'all' ? eq(t.status, status) : undefined,
        category ? eq(feedbackCategory.slug, category) : undefined,
        cursor
          ? or(
              gt(t.createdAt, new Date(cursor.createdAt)),
              and(eq(t.createdAt, new Date(cursor.createdAt)), gt(t.id, cursor.id)),
            )
          : undefined,
        followUp
          ? sql`exists (select 1 from ${feedbackComment} c where c.post_id = ${t.id} and c.created_at > (select max(r.created_at) from ${feedbackOfficialResponse} r where r.post_id = ${t.id}) and not exists (select 1 from ${userRole} ur where ur.user_id = c.author_id and ur.role = 'community-manager'))`
          : undefined,
      ),
    )
    .orderBy(asc(t.createdAt), asc(t.id))
    .limit(limit + 1)
  const posts = rows.slice(0, limit)
  return { posts, nextCursor: cursorFor(posts.at(-1), rows.length > limit) }
}
export async function listNotifications(
  actorId: string,
  { unread, cursor, limit = 20 }: Pagination & { unread?: boolean } = {},
) {
  return getDatabase().transaction(
    async (db) => {
      const t = feedbackNotification
      const rows = await db
        .select({
          id: t.id,
          postId: feedbackPost.id,
          postTitle: feedbackPost.title,
          responseId: t.responseId,
          createdAt: t.createdAt,
          readAt: t.readAt,
          status: feedbackOfficialResponse.status,
        })
        .from(t)
        .innerJoin(feedbackOfficialResponse, eq(feedbackOfficialResponse.id, t.responseId))
        .innerJoin(feedbackPost, eq(feedbackPost.id, feedbackOfficialResponse.postId))
        .where(
          and(
            eq(t.userId, actorId),
            unread ? isNull(t.readAt) : undefined,
            cursor
              ? or(
                  lt(t.createdAt, new Date(cursor.createdAt)),
                  and(eq(t.createdAt, new Date(cursor.createdAt)), lt(t.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(t.createdAt), desc(t.id))
        .limit(limit + 1)
      const [total] = await db
        .select({ count: count() })
        .from(t)
        .where(and(eq(t.userId, actorId), isNull(t.readAt)))
      const notifications = rows.slice(0, limit)
      return {
        notifications,
        nextCursor: cursorFor(notifications.at(-1), rows.length > limit),
        unreadCount: total!.count,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
export async function markNotificationRead(
  actorId: string,
  notificationId: string,
  requestId: string,
) {
  const where = and(
    eq(feedbackNotification.id, notificationId),
    eq(feedbackNotification.userId, actorId),
  )
  return feedbackWrite(
    actorId,
    requestId,
    'read-notification',
    { notificationId },
    async (transaction) => {
      const [notification] = await transaction
        .select({ id: feedbackNotification.id })
        .from(feedbackNotification)
        .where(where)
      if (!notification) throw new FeedbackWriteError(404, 'Notification not found.')
    },
    async (transaction) => {
      await transaction
        .update(feedbackNotification)
        .set({ readAt: new Date() })
        .where(and(where, isNull(feedbackNotification.readAt)))
      return { id: notificationId }
    },
  )
}
