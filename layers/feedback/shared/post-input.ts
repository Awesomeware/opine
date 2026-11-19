export const postLimits = { title: 200, description: 10_000, desiredImprovement: 5_000 } as const
export type PostInput = {
  title: string
  description: string
  desiredImprovement: string | null
  categoryId: string
}
export type PostFieldErrors = Partial<Record<keyof PostInput | 'form', string>>
export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}

export function validatePostInput(
  input: unknown,
): { success: true; data: PostInput } | { success: false; fieldErrors: PostFieldErrors } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { success: false, fieldErrors: { form: 'Enter your feedback below.' } }
  const fields = input as Record<string, unknown>
  const fieldErrors: PostFieldErrors = {}
  if (
    Object.keys(fields).some(
      (key) => !['title', 'description', 'desiredImprovement', 'categoryId'].includes(key),
    )
  ) {
    fieldErrors.form = 'The submission contains unexpected fields.'
  }
  const title = typeof fields.title === 'string' ? fields.title.trim() : ''
  const description = typeof fields.description === 'string' ? fields.description.trim() : ''
  const desiredImprovement =
    typeof fields.desiredImprovement === 'string' ? fields.desiredImprovement.trim() || null : null
  if (!title || title.length > postLimits.title)
    fieldErrors.title = `Enter a title between 1 and ${postLimits.title} characters.`
  if (!description || description.length > postLimits.description)
    fieldErrors.description = `Enter your feedback in 1–${postLimits.description} characters.`
  if (
    (fields.desiredImprovement != null && typeof fields.desiredImprovement !== 'string') ||
    (desiredImprovement && desiredImprovement.length > postLimits.desiredImprovement)
  ) {
    fieldErrors.desiredImprovement = `Use no more than ${postLimits.desiredImprovement} characters for your suggested improvement.`
  }
  for (const field of ['title', 'description', 'desiredImprovement'] as const) {
    if (typeof fields[field] === 'string' && fields[field].includes('\0')) {
      fieldErrors[field] = 'Remove the unsupported null character from this field.'
    }
  }
  if (!isUuid(fields.categoryId)) fieldErrors.categoryId = 'Choose a category.'
  if (Object.keys(fieldErrors).length || !isUuid(fields.categoryId))
    return { success: false, fieldErrors }
  return {
    success: true,
    data: { title, description, desiredImprovement, categoryId: fields.categoryId },
  }
}
