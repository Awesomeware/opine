import { and, asc, eq, gt, or } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { user } from '../../../auth/server/schema.ts'
import type { CategoryCorrectionInput } from '../../shared/review/input.ts'
import { cursorFor, type PostCursor } from '../list-input.ts'
import { findActiveCategory } from '../posts/categories.ts'
import { lockPost, updatePostWorkflow } from '../posts/workflow.ts'
import { feedbackCategoryChange } from '../schema.ts'
import { findWriteReceipt, lockActorWrites, saveWriteReceipt } from '../write-repository.ts'
import { FeedbackWriteError } from '../writes.ts'
import { checkWorkflowVersion } from './guards.ts'

type Pagination = { cursor?: PostCursor; limit?: number }

export async function correctCategory(
  actorId: string,
  postId: string,
  input: CategoryCorrectionInput,
  requestId: string,
) {
  return getDatabase().transaction(async (transaction) => {
    const request = {
      actorId,
      requestId,
      operation: 'correct-category',
      input: { postId, ...input },
    }

    await lockActorWrites(transaction, actorId)

    const receipt = await findWriteReceipt<{ id: string; version: number }>(transaction, request)
    if (receipt) return receipt

    const post = await lockPost(transaction, postId)
    checkWorkflowVersion(post.workflowVersion, input.version)

    const category = await findActiveCategory(transaction, input.categoryId)
    if (!category) throw new FeedbackWriteError(400, 'Choose an active category.')
    if (post.categoryId === input.categoryId) {
      return saveWriteReceipt(transaction, request, { id: postId, version: post.workflowVersion })
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

    return saveWriteReceipt(transaction, request, { id: postId, version: post.workflowVersion + 1 })
  })
}

export async function listCategoryHistory(postId: string, { cursor, limit = 20 }: Pagination = {}) {
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
  const changes = rows.slice(0, limit)
  return { changes, nextCursor: cursorFor(changes.at(-1), rows.length > limit) }
}
