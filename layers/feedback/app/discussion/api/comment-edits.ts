import type { FeedbackComment } from '../../../shared/discussion/contracts'
import type { CommentEditInput } from '../../../shared/discussion/input'

export function getComment(postId: string, id: string) {
  return $fetch<{ comment: FeedbackComment }>(
    `/api/feedback/posts/${postId}/comments/${encodeURIComponent(id)}`,
  )
}

export function editComment(
  postId: string,
  id: string,
  body: CommentEditInput,
  headers: Record<string, string>,
) {
  return $fetch(`/api/feedback/posts/${postId}/comments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    headers,
    retry: 0,
  })
}
