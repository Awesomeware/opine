import { isContributionType, type ContributionType } from './contribution-types.ts'
import type { ReactionKind } from './contracts.ts'
import { fields, validVersion, validateBody, type Validation } from '../input.ts'

export { commentLimit } from '../input.ts'

export type CommentInput = { body: string; type: ContributionType }

export type CommentEditInput = { body: string; type?: ContributionType; version: number }

export function validateCommentInput(input: unknown): Validation<CommentInput> {
  const value = fields(input, ['body', 'type'])
  if (!value)
    return { success: false, fieldErrors: { form: 'The comment contains unexpected fields.' } }
  const parsed = validateBody(value.body)
  const fieldErrors = parsed.success ? {} : parsed.fieldErrors
  if (!isContributionType(value.type))
    return { success: false, fieldErrors: { ...fieldErrors, type: 'Choose a contribution type.' } }
  return parsed.success
    ? { success: true, data: { body: parsed.data.body, type: value.type } }
    : parsed
}

export function validateCommentEditInput(input: unknown): Validation<CommentEditInput> {
  const value = fields(input, ['body', 'type', 'version'])
  if (!value || !validVersion(value.version))
    return { success: false, fieldErrors: { form: 'A valid comment version is required.' } }
  const parsed =
    'type' in value
      ? validateCommentInput({ body: value.body, type: value.type })
      : validateBody(value.body)
  return parsed.success
    ? { success: true, data: { ...parsed.data, version: value.version } }
    : parsed
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
