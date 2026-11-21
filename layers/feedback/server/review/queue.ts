import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user, userRole } from '../../../auth/server/schema.ts'
import type { PostStatus } from '../../shared/status.ts'
import {
  cursorCondition,
  defaultPageSize,
  paginateRows,
  type Pagination,
} from '../../../../server/pagination.ts'
import { publicPostFields } from '../posts/queries.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
} from '../schema.ts'

export async function listReviewQueue({
  status = 'new',
  category,
  followUp,
  cursor,
  limit = defaultPageSize,
}: Pagination & { status?: PostStatus | 'all'; category?: string; followUp?: boolean } = {}) {
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
        isNull(t.archivedAt),
        status !== 'all' ? eq(t.status, status) : undefined,
        category ? eq(feedbackCategory.slug, category) : undefined,
        cursorCondition(t, cursor, 'asc'),
        followUp
          ? sql`exists (select 1 from ${feedbackComment} c where c.post_id = ${t.id} and c.created_at > (select max(r.created_at) from ${feedbackOfficialResponse} r where r.post_id = ${t.id}) and not exists (select 1 from ${userRole} ur where ur.user_id = c.author_id and ur.role = 'community-manager'))`
          : undefined,
      ),
    )
    .orderBy(asc(t.createdAt), asc(t.id))
    .limit(limit + 1)
  const { items: posts, nextCursor } = paginateRows(rows, limit)
  return { posts, nextCursor }
}
