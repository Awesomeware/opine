import { and, count, desc, eq, isNull, lt, or } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { feedbackNotification, feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import { feedbackWrite, FeedbackWriteError } from '../writes.ts'

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
