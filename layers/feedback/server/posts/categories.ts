import { and, asc, eq } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { feedbackCategory } from '../schema.ts'
import type { FeedbackTransaction } from '../writes.ts'

export function listCategories() {
  return getDatabase()
    .select({
      id: feedbackCategory.id,
      slug: feedbackCategory.slug,
      name: feedbackCategory.name,
      isActive: feedbackCategory.isActive,
    })
    .from(feedbackCategory)
    .orderBy(asc(feedbackCategory.sortOrder), asc(feedbackCategory.name), asc(feedbackCategory.id))
}

// Operator-only configuration. No public endpoint may call these without authorization.
export async function upsertCategory(slug: string, name: string, sortOrder = 0) {
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 80 ||
    !name.trim() ||
    name.trim().length > 80 ||
    !Number.isInteger(sortOrder) ||
    sortOrder < -2147483648 ||
    sortOrder > 2147483647
  ) {
    throw new Error('Use a lowercase slug, a name of 1–80 characters, and an integer sort order.')
  }
  const [category] = await getDatabase()
    .insert(feedbackCategory)
    .values({ slug, name: name.trim(), sortOrder })
    .onConflictDoUpdate({
      target: feedbackCategory.slug,
      set: { name: name.trim(), sortOrder, updatedAt: new Date() },
    })
    .returning()
  return category!
}

export async function setCategoryActive(slug: string, isActive: boolean) {
  const [category] = await getDatabase()
    .update(feedbackCategory)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(feedbackCategory.slug, slug))
    .returning({ id: feedbackCategory.id })
  return Boolean(category)
}

// The share lock keeps the category active until the caller commits its write.
export async function findActiveCategory(transaction: FeedbackTransaction, categoryId: string) {
  const [category] = await transaction
    .select({ id: feedbackCategory.id })
    .from(feedbackCategory)
    .where(and(eq(feedbackCategory.id, categoryId), eq(feedbackCategory.isActive, true)))
    .for('share')
  return category
}
