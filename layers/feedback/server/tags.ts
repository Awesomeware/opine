import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { userRole } from '../../auth/server/schema.ts'
import type { FeedbackTag } from '../shared/contracts.ts'
import type { TagInput, TagEditInput } from '../shared/tag-input.ts'
import { feedbackPost, feedbackPostTag, feedbackTag } from './schema.ts'
import { feedbackWrite, FeedbackWriteError, type FeedbackTransaction } from './writes.ts'

export const defaultFeedbackTags = ['Gameplay', 'UI', 'Class-specific', 'Combat', '$$$'].map(
  (name, index) => ({ id: `10000000-0000-4000-8000-00000000000${index + 1}`, name }),
)
export function listTags() {
  return getDatabase()
    .select()
    .from(feedbackTag)
    .orderBy(asc(sql`lower(${feedbackTag.name})`), asc(feedbackTag.id))
}
// Correlated aggregation is part of the post SELECT, preserving a single text/tag snapshot.
export const postTagsField = sql<
  FeedbackTag[]
>`coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'isActive', t.is_active, 'version', t.version) order by lower(t.name), t.id) from feedback_post_tag pt join feedback_tag t on t.id = pt.tag_id where pt.post_id = ${feedbackPost.id}), '[]'::jsonb)`
async function requireAdmin(transaction: FeedbackTransaction, actorId: string) {
  const [role] = await transaction
    .select()
    .from(userRole)
    .where(and(eq(userRole.userId, actorId), eq(userRole.role, 'administrator')))
  if (!role) throw new FeedbackWriteError(403, 'Administrator access is required.')
}
async function tagWrite<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const cause = error instanceof Error && 'cause' in error ? error.cause : error
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505')
      throw new FeedbackWriteError(409, 'A tag with that name already exists.')
    throw error
  }
}
export function createTag(actorId: string, input: TagInput, requestId: string) {
  return tagWrite(() =>
    feedbackWrite(
      actorId,
      requestId,
      'create-tag',
      input,
      (transaction) => requireAdmin(transaction, actorId),
      async (transaction) => {
        const [tag] = await transaction
          .insert(feedbackTag)
          .values(input)
          .returning({ id: feedbackTag.id, version: feedbackTag.version })
        return tag!
      },
    ),
  )
}
export function updateTag(actorId: string, tagId: string, input: TagEditInput, requestId: string) {
  return tagWrite(() =>
    feedbackWrite(
      actorId,
      requestId,
      'update-tag',
      { tagId, ...input },
      (transaction) => requireAdmin(transaction, actorId),
      async (transaction) => {
        const [tag] = await transaction
          .select()
          .from(feedbackTag)
          .where(eq(feedbackTag.id, tagId))
          .for('update')
        if (!tag) throw new FeedbackWriteError(404, 'Tag not found.')
        if (tag.version !== input.version)
          throw new FeedbackWriteError(
            409,
            'This tag has changed. Review the latest version before saving.',
          )
        if (tag.name === input.name && tag.isActive === input.isActive)
          return { id: tag.id, version: tag.version }
        const [updated] = await transaction
          .update(feedbackTag)
          .set({ name: input.name, isActive: input.isActive, version: tag.version + 1 })
          .where(eq(feedbackTag.id, tagId))
          .returning({ id: feedbackTag.id, version: feedbackTag.version })
        return updated!
      },
    ),
  )
}
export async function replacePostTags(
  transaction: FeedbackTransaction,
  postId: string,
  tagIds: string[],
  previous: string[] = [],
) {
  if (tagIds.length) {
    const tags = await transaction
      .select()
      .from(feedbackTag)
      .where(inArray(feedbackTag.id, tagIds))
      .orderBy(asc(feedbackTag.id))
      .for('share')
    if (
      tags.length !== tagIds.length ||
      tags.some((tag) => !tag.isActive && !previous.includes(tag.id))
    )
      throw new FeedbackWriteError(
        400,
        'Choose active tags. Unavailable tags already attached may be kept or removed.',
      )
  }
  await transaction.delete(feedbackPostTag).where(eq(feedbackPostTag.postId, postId))
  if (tagIds.length)
    await transaction.insert(feedbackPostTag).values(tagIds.map((tagId) => ({ postId, tagId })))
}
