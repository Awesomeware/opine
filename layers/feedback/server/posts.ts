import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { user } from '../../auth/server/schema.ts'
import type { PostInput } from '../shared/post-input.ts'
import type { ListPostsInput } from './list-input.ts'
import { feedbackWrite, positiveInteger } from './writes.ts'
import { postTagsField, replacePostTags } from './tags.ts'
import { feedbackCategory, feedbackFollow, feedbackPost } from './schema.ts'

export class PostingRateLimitError extends Error {
  retryAfterSeconds: number
  constructor(seconds: number) {
    super('Please wait before submitting more feedback.')
    this.retryAfterSeconds = seconds
  }
}

// The caller supplies an authenticated internal user ID and validated input.
export async function createPost(
  authorId: string,
  input: PostInput,
  requestId: string = randomUUID(),
) {
  const max = positiveInteger('FEEDBACK_POST_MAX', 5)
  const windowSeconds = positiveInteger('FEEDBACK_POST_WINDOW_SECONDS', 60)
  return feedbackWrite(
    authorId,
    requestId,
    'create-post',
    input,
    async () => {},
    async (transaction) => {
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
      const { tagIds, ...postInput } = input
      const [post] = await transaction
        .insert(feedbackPost)
        .values({ ...postInput, authorId })
        .returning({ id: feedbackPost.id })
      await replacePostTags(transaction, post!.id, tagIds ?? [])
      await transaction.insert(feedbackFollow).values({ postId: post!.id, userId: authorId })
      return post!
    },
  )
}

const publicFields = {
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
      ...publicFields,
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
