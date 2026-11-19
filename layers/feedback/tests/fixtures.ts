import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { getDatabase } from '../../../server/db/index.ts'
import { feedbackCategory, feedbackPost } from '../server/schema.ts'

function assertTestDatabase() {
  assert.ok(
    process.env.OPINE_TEST_DATABASE_URL,
    'Feedback fixtures require an isolated test database.',
  )
  assert.equal(process.env.DATABASE_URL, process.env.OPINE_TEST_DATABASE_URL)
}

export async function createCategory(options: Partial<typeof feedbackCategory.$inferInsert> = {}) {
  assertTestDatabase()
  const id = randomUUID()
  const [category] = await getDatabase()
    .insert(feedbackCategory)
    .values({
      id,
      slug: `category-${id}`,
      name: 'Combat',
      ...options,
    })
    .returning()
  return category!
}

export async function createFeedbackPost(
  options: Pick<typeof feedbackPost.$inferInsert, 'authorId' | 'categoryId'> &
    Partial<typeof feedbackPost.$inferInsert>,
) {
  assertTestDatabase()
  const [post] = await getDatabase()
    .insert(feedbackPost)
    .values({
      title: 'Make combat feedback clearer',
      description: 'I cannot tell when a hit connects during combat.',
      ...options,
    })
    .returning()
  return post!
}
