import type { FeedbackCategory, FeedbackPost } from '../../../shared/posts/contracts'
import type { PostInput } from '../../../shared/posts/input'
import type { PostEditInput } from '../../../shared/posts/input'

export function getPost(id: string) {
  return $fetch<{ post: FeedbackPost }>(`/api/feedback/posts/${encodeURIComponent(id)}`)
}

export function getCategories() {
  return $fetch<{ categories: FeedbackCategory[] }>('/api/feedback/categories')
}

export function createPost(body: PostInput, headers: Record<string, string>) {
  return $fetch<{ id: string }>('/api/feedback/posts', { method: 'POST', body, headers, retry: 0 })
}

export function editPost(id: string, body: PostEditInput, headers: Record<string, string>) {
  return $fetch(`/api/feedback/posts/${id}`, { method: 'PATCH', body, headers, retry: 0 })
}
