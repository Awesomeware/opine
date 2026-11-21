import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import { cursorFor, type ListPostsInput } from '../list-input.ts'
import { feedbackCategory, feedbackPost } from '../schema.ts'
import { postTagsField } from './tags.ts'

export const publicPostFields = {
  tags: postTagsField,
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
        ? sql<boolean>`${feedbackPost.authorId} = ${viewerId}`
        : sql<boolean>`false`,
    })
    .from(feedbackPost)
    .innerJoin(user, eq(user.id, feedbackPost.authorId))
    .innerJoin(feedbackCategory, eq(feedbackCategory.id, feedbackPost.categoryId))
    .where(eq(feedbackPost.id, id))
    .limit(1)
  return post
}

export async function listPosts({
  q,
  category,
  status,
  cursor,
  limit = 20,
}: Partial<ListPostsInput> = {}) {
  // Escape LIKE metacharacters so search terms are literal, including % and _.
  const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : undefined
  const posts = await getDatabase()
    .select({ ...publicPostFields, excerpt: sql<string>`left(${feedbackPost.description}, 240)` })
    .from(feedbackPost)
    .innerJoin(user, eq(user.id, feedbackPost.authorId))
    .innerJoin(feedbackCategory, eq(feedbackCategory.id, feedbackPost.categoryId))
    .where(
      and(
        pattern
          ? or(ilike(feedbackPost.title, pattern), ilike(feedbackPost.description, pattern))
          : undefined,
        category ? eq(feedbackCategory.slug, category) : undefined,
        status ? eq(feedbackPost.status, status) : undefined,
        cursor
          ? or(
              lt(feedbackPost.createdAt, new Date(cursor.createdAt)),
              and(
                eq(feedbackPost.createdAt, new Date(cursor.createdAt)),
                lt(feedbackPost.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(feedbackPost.createdAt), desc(feedbackPost.id))
    .limit(limit + 1)
  const more = posts.length > limit
  const page = posts.slice(0, limit)
  const last = page.at(-1)
  return {
    posts: page,
    nextCursor: cursorFor(last, more),
  }
}
