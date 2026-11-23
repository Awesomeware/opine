import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../../../server/db/index.ts'
import { feedbackTag, feedbackPost, feedbackPostTag } from '../server/schema.ts'

function assertTestDatabase() {
  assert.ok(
    process.env.OPINE_TEST_DATABASE_URL,
    'Feedback fixtures require an isolated test database.',
  )
  assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)
}

export async function createTag(options: Partial<typeof feedbackTag.$inferInsert> = {}) {
  assertTestDatabase()
  const id = randomUUID()
  const [tag] = await getDatabase()
    .insert(feedbackTag)
    .values({
      id,
      name: `Tag ${id.slice(0, 8)}`,
      ...options,
    })
    .returning()
  return tag!
}

export async function createFeedbackPost(
  options: Pick<typeof feedbackPost.$inferInsert, 'authorId'> &
    Partial<typeof feedbackPost.$inferInsert> & { tagIds?: string[] },
) {
  assertTestDatabase()
  const { tagIds = [], ...postInput } = options
  const [post] = await getDatabase()
    .insert(feedbackPost)
    .values({
      title: 'Make combat feedback clearer',
      description: 'I cannot tell when a hit connects during combat.',
      ...postInput,
    })
    .returning()
  if (tagIds.length) {
    await getDatabase()
      .insert(feedbackPostTag)
      .values(tagIds.map((tagId) => ({ postId: post!.id, tagId })))
  }
  return post!
}
