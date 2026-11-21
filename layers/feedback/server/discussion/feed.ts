import { and, asc, eq, gt, isNull, or } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import type { ContributionType } from '../../shared/discussion/contribution-types.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { responseFields } from '../review/outcome.ts'
import { feedbackOfficialResponse, feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { listComments } from './comments.ts'

type Pagination = { cursor?: PostCursor; limit?: number }

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
          .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
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
