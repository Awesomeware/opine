import type { FeedbackPost } from '../../../shared/posts/contracts'
import type { PostInput } from '../../../shared/posts/input'
import type { PostEditInput } from '../../../shared/posts/input'

export function getPost(id: string) {
  return $fetch<{ post: FeedbackPost }>(`/api/feedback/posts/${encodeURIComponent(id)}`)
}

export function createPost(body: PostInput) {
  return $fetch<{ id: string }>('/api/feedback/posts', { method: 'POST', body, retry: 0 })
}

export function editPost(id: string, body: PostEditInput) {
  return $fetch(`/api/feedback/posts/${id}`, { method: 'PATCH', body, retry: 0 })
}
