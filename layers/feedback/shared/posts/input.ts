import { fields, validVersion, isUuid, type Validation } from '../input.ts'

export const postLimits = { title: 200, description: 10_000, desiredImprovement: 5_000 } as const
export type PostInput = {
  title: string
  description: string
  desiredImprovement: string | null
  tagIds?: string[]
  categoryId: string
}

export type PostFieldErrors = Partial<Record<keyof PostInput | 'form', string>>
export function validatePostContent(
  input: unknown,
):
  | { success: true; data: Omit<PostInput, 'categoryId'> }
  | { success: false; fieldErrors: PostFieldErrors } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { success: false, fieldErrors: { form: 'Enter your feedback below.' } }
  const fields = input as Record<string, unknown>
  const fieldErrors: PostFieldErrors = {}
  if (
    Object.keys(fields).some(
      (key) => !['title', 'description', 'desiredImprovement', 'tagIds'].includes(key),
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
  let tagIds: string[] | undefined
  if ('tagIds' in fields) {
    if (!Array.isArray(fields.tagIds) || fields.tagIds.length > 100 || !fields.tagIds.every(isUuid))
      fieldErrors.tagIds = 'Choose up to 100 valid tags.'
    else tagIds = [...new Set(fields.tagIds.map((id) => id.toLowerCase()))].sort()
  }
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors }
  return {
    success: true,
    data: {
      title,
      description,
      desiredImprovement,
      ...(tagIds !== undefined ? { tagIds } : {}),
    },
  }
}

export function validatePostInput(
  input: unknown,
): { success: true; data: PostInput } | { success: false; fieldErrors: PostFieldErrors } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { success: false, fieldErrors: { form: 'Enter your feedback below.' } }
  const { categoryId, ...content } = input as Record<string, unknown>
  const parsed = validatePostContent(content)
  const fieldErrors: PostFieldErrors = parsed.success ? {} : parsed.fieldErrors
  if (!isUuid(categoryId)) fieldErrors.categoryId = 'Choose a category.'
  if (!parsed.success || !isUuid(categoryId)) return { success: false, fieldErrors }
  const { tagIds, ...contentData } = parsed.data
  return {
    success: true,
    data: { ...contentData, categoryId, ...(tagIds !== undefined ? { tagIds } : {}) },
  }
}

export type PostEditInput = Omit<PostInput, 'categoryId'> & { version: number }

export function validatePostEditInput(input: unknown): Validation<PostEditInput> {
  const value = fields(input, ['title', 'description', 'desiredImprovement', 'version', 'tagIds'])
  if (!value || !validVersion(value.version))
    return { success: false, fieldErrors: { form: 'A valid feedback version is required.' } }
  const parsed = validatePostContent({
    title: value.title,
    description: value.description,
    desiredImprovement: value.desiredImprovement,
    ...('tagIds' in value ? { tagIds: value.tagIds } : {}),
  })
  if (!parsed.success) return parsed
  const { title, description, desiredImprovement, tagIds } = parsed.data
  return {
    success: true,
    data: {
      title,
      description,
      desiredImprovement,
      version: value.version,
      ...(tagIds !== undefined ? { tagIds } : {}),
    },
  }
}
