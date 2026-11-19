import { and, count, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import type { PostInput } from '../shared/post-input.ts'
import type { ListPostsInput } from './list-input.ts'
import { feedbackCategory, feedbackFollow, feedbackPost } from './schema.ts'

export class PostingRateLimitError extends Error {
  retryAfterSeconds: number
  constructor(seconds: number) {
    super('Please wait before submitting more feedback.')
    this.retryAfterSeconds = seconds
  }
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > 86400)
    throw new Error(`${name} must be an integer between 1 and 86400.`)
  return value
}

// The caller supplies an authenticated internal user ID and validated input.
export async function createPost(authorId: string, input: PostInput) {
  const max = positiveInteger('FEEDBACK_POST_MAX', 5)
  const windowSeconds = positiveInteger('FEEDBACK_POST_WINDOW_SECONDS', 60)
  return getDatabase().transaction(async (transaction) => {
    // Serialize submissions by author so concurrent requests cannot bypass the limit.
    await transaction.select({ id: user.id }).from(user).where(eq(user.id, authorId)).for('update')
    const [recent] = await transaction
      .select({ count: count() })
      .from(feedbackPost)
      .where(
        and(
          eq(feedbackPost.authorId, authorId),
          gte(feedbackPost.createdAt, new Date(Date.now() - windowSeconds * 1000)),
        ),
      )
    if (recent && recent.count >= max) throw new PostingRateLimitError(windowSeconds)
    const [category] = await transaction
      .select({ id: feedbackCategory.id })
      .from(feedbackCategory)
      .where(and(eq(feedbackCategory.id, input.categoryId), eq(feedbackCategory.isActive, true)))
      .for('share')
    if (!category) return null
    const [post] = await transaction
      .insert(feedbackPost)
      .values({ ...input, authorId })
      .returning({ id: feedbackPost.id })
    await transaction.insert(feedbackFollow).values({ postId: post!.id, userId: authorId })
    return post!
  })
}

const publicFields = {
  id: feedbackPost.id,
  title: feedbackPost.title,
  status: feedbackPost.status,
  createdAt: feedbackPost.createdAt,
  author: { name: user.name },
  category: { id: feedbackCategory.id, slug: feedbackCategory.slug, name: feedbackCategory.name },
}

export async function getPost(id: string) {
  const [post] = await getDatabase()
    .select({
      ...publicFields,
      description: feedbackPost.description,
      desiredImprovement: feedbackPost.desiredImprovement,
      updatedAt: feedbackPost.updatedAt,
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
    .select({ ...publicFields, excerpt: sql<string>`left(${feedbackPost.description}, 240)` })
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
    nextCursor:
      more && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
          ).toString('base64url')
        : null,
  }
}
