import { isRecord } from './stored-input.ts'
import { isContributionType, type ContributionType } from '../../shared/contribution-types.ts'
import {
  validatePostEditInput,
  validateCommentEditInput,
} from '../../shared/participation-input.ts'
import { validatePostInput } from '../../shared/post-input.ts'

export type PostForm = {
  title: string
  description: string
  desiredImprovement: string
  tagIds: string[]
  version: number
}

export type CommentForm = {
  body: string
  type: ContributionType | ''
  version: number
}

export type SubmissionForm = Omit<PostForm, 'version'> & { categoryId: string }

/** Restore only understood fields; stored drafts are not API responses. */
export function parsePostDraft(value: unknown): Partial<PostForm> {
  if (!isRecord(value) || !validVersion(value.version)) {
    return {}
  }

  const { title, description, desiredImprovement, tagIds } = parseSubmissionDraft(value)

  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(desiredImprovement !== undefined ? { desiredImprovement } : {}),
    ...(tagIds !== undefined ? { tagIds } : {}),
    version: value.version,
  }
}

export function parseSubmissionDraft(value: unknown): Partial<SubmissionForm> {
  if (!isRecord(value)) {
    return {}
  }

  const draft: Partial<SubmissionForm> = {}

  for (const key of ['title', 'description', 'desiredImprovement', 'categoryId'] as const) {
    if (typeof value[key] === 'string') {
      draft[key] = value[key]
    }
  }

  if (
    Array.isArray(value.tagIds) &&
    value.tagIds.every((id): id is string => typeof id === 'string')
  ) {
    draft.tagIds = value.tagIds
  }

  return draft
}

export function parseCommentDraft(value: unknown): Partial<CommentForm> {
  if (!isRecord(value) || !validVersion(value.version)) {
    return {}
  }

  return {
    version: value.version,
    ...(typeof value.body === 'string' ? { body: value.body } : {}),
    ...(isContributionType(value.type) ? { type: value.type } : {}),
  }
}

function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 2147483647
}

/** Omission preserves assignments and legacy receipt fingerprints; [] explicitly clears tags. */
export function postEditInput(form: PostForm, baselineTagIds: string[], pending: unknown) {
  const tagsChanged =
    JSON.stringify([...form.tagIds].sort()) !== JSON.stringify([...baselineTagIds].sort())

  return validatePostEditInput({
    title: form.title,
    description: form.description,
    desiredImprovement: form.desiredImprovement || null,
    version: form.version,
    ...(tagsChanged || (isRecord(pending) && Array.isArray(pending.tagIds))
      ? { tagIds: form.tagIds }
      : {}),
  })
}

/** Unchanged classification stays omitted unless an uncertain write already included it. */
export function commentEditInput(
  form: CommentForm,
  baselineType: ContributionType | '',
  pending: unknown,
) {
  const includeType =
    form.type && (form.type !== baselineType || (isRecord(pending) && pending.type === form.type))

  return validateCommentEditInput({
    body: form.body,
    version: form.version,
    ...(includeType ? { type: form.type } : {}),
  })
}

export function submissionInput(form: SubmissionForm, pending: unknown) {
  const { tagIds, ...text } = form

  // A submission started before tags existed must recover its original receipt.
  return validatePostInput(
    isRecord(pending) && !('tagIds' in pending) && !tagIds.length ? text : form,
  )
}
