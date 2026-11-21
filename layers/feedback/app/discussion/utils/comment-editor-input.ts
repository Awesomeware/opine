import type { ContributionType } from '../../../shared/discussion/contribution-types.ts'
import { validateCommentEditInput } from '../../../shared/discussion/input.ts'

export type CommentForm = {
  body: string
  type: ContributionType | ''
  version: number
}

/** Omit unchanged classification so unclassified legacy comments can still be edited. */
export function commentEditInput(form: CommentForm, baselineType: ContributionType | '') {
  const includeType = form.type && form.type !== baselineType

  return validateCommentEditInput({
    body: form.body,
    version: form.version,
    ...(includeType ? { type: form.type } : {}),
  })
}
