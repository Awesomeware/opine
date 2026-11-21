import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { cursorCondition, defaultPageSize, paginateRows } from '../../../../server/pagination.ts'
import type { ListPostsInput } from '../list-input.ts'
import { feedbackCategory, feedbackPost } from '../schema.ts'
import { postTagsField } from './tags.ts'

export const publicPostFields = {
  tags: postTagsField,
  lockedAt: feedbackPost.lockedAt,
  id: feedbackPost.id,
  title: feedbackPost.title,
  status: feedbackPost.status,
  createdAt: feedbackPost.createdAt,
  author: { name: user.name },
  category: { id: feedbackCategory.id, slug: feedbackCategory.slug, name: feedbackCategory.name },
}

export async function getPost(id: string, viewerId?: string) {
  const [post] = await getDatabase()
    .select({
      ...publicPostFields,
      description: feedbackPost.description,
      desiredImprovement: feedbackPost.desiredImprovement,
      updatedAt: feedbackPost.updatedAt,
      editedAt: feedbackPost.editedAt,
      version: feedbackPost.version,
      canEdit: viewerId
        ? sql<boolean>`${feedbackPost.authorId} = ${viewerId} and ${feedbackPost.lockedAt} is null`
        : sql<boolean>`false`,
    })
    .from(feedbackPost)
    .innerJoin(user, eq(user.id, feedbackPost.authorId))
    .innerJoin(feedbackCategory, eq(feedbackCategory.id, feedbackPost.categoryId))
    .where(and(eq(feedbackPost.id, id), isNull(feedbackPost.archivedAt)))
    .limit(1)
  return post
}

export async function listPosts({
  q,
  category,
  status,
  cursor,
  limit = defaultPageSize,
}: Partial<ListPostsInput> = {}) {
  // Escape LIKE metacharacters so search terms are literal, including % and _.
  const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : undefined
  const rows = await getDatabase()
    .select({ ...publicPostFields, excerpt: sql<string>`left(${feedbackPost.description}, 240)` })
    .from(feedbackPost)
    .innerJoin(user, eq(user.id, feedbackPost.authorId))
    .innerJoin(feedbackCategory, eq(feedbackCategory.id, feedbackPost.categoryId))
    .where(
      and(
        isNull(feedbackPost.archivedAt),
        pattern
          ? or(ilike(feedbackPost.title, pattern), ilike(feedbackPost.description, pattern))
          : undefined,
        category ? eq(feedbackCategory.slug, category) : undefined,
        status ? eq(feedbackPost.status, status) : undefined,
        cursorCondition(feedbackPost, cursor, 'desc'),
      ),
    )
    .orderBy(desc(feedbackPost.createdAt), desc(feedbackPost.id))
    .limit(limit + 1)
  const { items: posts, nextCursor } = paginateRows(rows, limit)
  return { posts, nextCursor }
}
