import { and, asc, eq, gt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user, userRole } from '../../../auth/server/schema.ts'
import type { PostStatus } from '../../shared/status.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { publicPostFields } from '../posts/queries.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
} from '../schema.ts'
import { requireManager } from './guards.ts'

type Pagination = { cursor?: PostCursor; limit?: number }

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
