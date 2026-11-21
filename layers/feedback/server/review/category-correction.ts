import { and, asc, eq, isNull } from 'drizzle-orm'
import { appendEvent } from '../../../../server/events/repository.ts'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import type { CategoryCorrectionInput } from '../../shared/review/input.ts'
import {
  cursorCondition,
  defaultPageSize,
  paginateRows,
  type Pagination,
} from '../../../../server/pagination.ts'
import { findActiveCategory } from '../posts/categories.ts'
import { lockPost, updatePostWorkflow } from '../posts/workflow.ts'
import { feedbackCategoryChange, feedbackPost } from '../schema.ts'
import { FeedbackWriteError } from '../writes.ts'
import { checkWorkflowVersion } from './guards.ts'

export async function correctCategory(
  actorId: string,
  postId: string,
  input: CategoryCorrectionInput,
) {
  return getDatabase().transaction(async (transaction) => {
    const post = await lockPost(transaction, postId)
    checkWorkflowVersion(post.workflowVersion, input.version)

    const category = await findActiveCategory(transaction, input.categoryId)
    if (!category) throw new FeedbackWriteError(400, 'Choose an active category.')
    if (post.categoryId === input.categoryId) {
      return { id: postId, version: post.workflowVersion }
    }
    await transaction.insert(feedbackCategoryChange).values({
      postId,
      actorId,
      previousCategoryId: post.categoryId,
      categoryId: input.categoryId,
    })
    await updatePostWorkflow(transaction, postId, post.workflowVersion + 1, {
      categoryId: input.categoryId,
    })

    await appendEvent(transaction, {
      type: 'post.category_changed',
      actorId,
      details: { postId, fromCategoryId: post.categoryId, toCategoryId: input.categoryId },
    })
    return { id: postId, version: post.workflowVersion + 1 }
  })
}

export async function listCategoryHistory(
  postId: string,
  { cursor, limit = defaultPageSize }: Pagination = {},
) {
  const [post] = await getDatabase()
    .select({ id: feedbackPost.id })
    .from(feedbackPost)
    .where(and(eq(feedbackPost.id, postId), isNull(feedbackPost.archivedAt)))
  if (!post) throw new FeedbackWriteError(404, 'Feedback not found.')

  const t = feedbackCategoryChange
  const rows = await getDatabase()
    .select({
      id: t.id,
      previousCategoryId: t.previousCategoryId,
      categoryId: t.categoryId,
      actor: { name: user.name },
      createdAt: t.createdAt,
    })
    .from(t)
    .innerJoin(user, eq(user.id, t.actorId))
    .innerJoin(feedbackPost, eq(feedbackPost.id, t.postId))
    .where(
      and(eq(t.postId, postId), isNull(feedbackPost.archivedAt), cursorCondition(t, cursor, 'asc')),
    )
    .orderBy(asc(t.createdAt), asc(t.id))
    .limit(limit + 1)
  const { items: changes, nextCursor } = paginateRows(rows, limit)
  return { changes, nextCursor }
}
