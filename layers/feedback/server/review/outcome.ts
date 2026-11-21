import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user, userRole } from '../../../auth/server/schema.ts'
import { feedbackFollow, feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'

export const responseFields = {
  id: feedbackOfficialResponse.id,
  postId: feedbackOfficialResponse.postId,
  body: feedbackOfficialResponse.body,
  author: { name: user.name },
  createdAt: feedbackOfficialResponse.createdAt,
  previousStatus: feedbackOfficialResponse.previousStatus,
  status: feedbackOfficialResponse.status,
}

export async function getOfficialResponse(postId: string, responseId: string) {
  const [response] = await getDatabase()
    .select(responseFields)
    .from(feedbackOfficialResponse)
    .innerJoin(user, eq(user.id, feedbackOfficialResponse.authorId))
    .innerJoin(feedbackPost, eq(feedbackPost.id, feedbackOfficialResponse.postId))
    .where(
      and(
        eq(feedbackOfficialResponse.postId, postId),
        eq(feedbackOfficialResponse.id, responseId),
        isNull(feedbackPost.archivedAt),
      ),
    )
  return response
}

export async function getOutcome(postId: string, viewerId?: string) {
  return getDatabase().transaction(
    async (db) => {
      const [post] = await db
        .select({
          lockedAt: feedbackPost.lockedAt,
          status: feedbackPost.status,
          version: feedbackPost.workflowVersion,
        })
        .from(feedbackPost)
        .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
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
        canRespond: roles.length > 0 && !post.lockedAt,
        canModerate: roles.length > 0,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
}
