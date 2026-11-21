import { validatePostEditInput } from '../../../shared/posts/input.ts'

export type PostForm = {
  title: string
  description: string
  desiredImprovement: string
  tagIds: string[]
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
