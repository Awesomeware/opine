import { validatePostInput, type PostInput } from './post-input.ts'
import type { ReactionKind } from './contracts.ts'

export const commentLimit = 10_000
export type PostEditInput = Omit<PostInput, 'categoryId'> & { version: number }
export type CommentInput = { body: string }
export type CommentEditInput = CommentInput & { version: number }
type Validation<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> }

function fields(input: unknown, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  return Object.keys(value).some((key) => !allowed.includes(key)) ? null : value
}
function validVersion(version: unknown): version is number {
  return (
    typeof version === 'number' &&
    Number.isSafeInteger(version) &&
    version >= 1 &&
    version < 2147483647
  )
}
export function validateCommentInput(input: unknown): Validation<CommentInput> {
  const value = fields(input, ['body'])
  if (!value)
    return { success: false, fieldErrors: { form: 'The comment contains unexpected fields.' } }
  const body = typeof value.body === 'string' ? value.body.trim() : ''
  if (!body || body.length > commentLimit || body.includes('\0'))
    return {
      success: false,
      fieldErrors: { body: 'Enter a comment in 1–10000 characters without null characters.' },
    }
  return { success: true, data: { body } }
}
export function validateCommentEditInput(input: unknown): Validation<CommentEditInput> {
  const value = fields(input, ['body', 'version'])
  if (!value || !validVersion(value.version))
    return { success: false, fieldErrors: { form: 'A valid comment version is required.' } }
  const parsed = validateCommentInput({ body: value.body })
  return parsed.success
    ? { success: true, data: { ...parsed.data, version: value.version } }
    : parsed
}
export function validatePostEditInput(input: unknown): Validation<PostEditInput> {
  const value = fields(input, ['title', 'description', 'desiredImprovement', 'version'])
  if (!value || !validVersion(value.version))
    return { success: false, fieldErrors: { form: 'A valid feedback version is required.' } }
  const parsed = validatePostInput({
    title: value.title,
    description: value.description,
    desiredImprovement: value.desiredImprovement,
    categoryId: '00000000-0000-0000-0000-000000000001',
  })
  if (!parsed.success) return parsed
  const { title, description, desiredImprovement } = parsed.data
  return { success: true, data: { title, description, desiredImprovement, version: value.version } }
}
export function validateReactionInput(input: unknown): Validation<{ kind: ReactionKind | null }> {
  const value = fields(input, ['kind'])
  if (!value || !['agree', 'disagree', null].includes(value.kind as string | null))
    return {
      success: false,
      fieldErrors: { kind: 'Choose Agree, Disagree, or remove your reaction.' },
    }
  return { success: true, data: { kind: value.kind as ReactionKind | null } }
}
