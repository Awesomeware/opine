import { type ContributionType } from '../../shared/contribution-types.ts'
import {
  validatePostEditInput,
  validateCommentEditInput,
} from '../../shared/participation-input.ts'

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

/** Omission preserves existing assignments; [] explicitly clears tags. */
export function postEditInput(form: PostForm, baselineTagIds: string[]) {
  const tagsChanged =
    JSON.stringify([...form.tagIds].sort()) !== JSON.stringify([...baselineTagIds].sort())

  return validatePostEditInput({
    title: form.title,
    description: form.description,
    desiredImprovement: form.desiredImprovement || null,
    version: form.version,
    ...(tagsChanged ? { tagIds: form.tagIds } : {}),
  })
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
