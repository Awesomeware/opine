import { and, count, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { feedbackNotification, feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'

type Pagination = { cursor?: PostCursor; limit?: number }

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
            isNull(feedbackPost.archivedAt),
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
        .innerJoin(feedbackOfficialResponse, eq(feedbackOfficialResponse.id, t.responseId))
        .innerJoin(feedbackPost, eq(feedbackPost.id, feedbackOfficialResponse.postId))
        .where(and(eq(t.userId, actorId), isNull(t.readAt), isNull(feedbackPost.archivedAt)))
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

export async function markNotificationRead(actorId: string, notificationId: string) {
  const where = and(
    eq(feedbackNotification.id, notificationId),
    eq(feedbackNotification.userId, actorId),
    sql`exists (select 1 from ${feedbackOfficialResponse} r join ${feedbackPost} p on p.id = r.post_id where r.id = ${feedbackNotification.responseId} and p.archived_at is null)`,
  )
  const [notification] = await getDatabase()
    .update(feedbackNotification)
    .set({ readAt: sql`coalesce(${feedbackNotification.readAt}, now())` })
    .where(where)
    .returning({ id: feedbackNotification.id })
  if (!notification) throw new FeedbackWriteError(404, 'Notification not found.')
  return notification
}
