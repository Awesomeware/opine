import type { FeedbackTag } from '../../../shared/posts/contracts'
import type { TagInput, TagEditInput } from '../../../shared/posts/tag-input'

export function getTags() {
  return $fetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
}

export function createTag(body: TagInput) {
  return $fetch('/api/feedback/tags', { method: 'POST', body, retry: 0 })
}

export function updateTag(id: string, body: TagEditInput) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/tags/${id}`, {
    method: 'PATCH',
    body,
    retry: 0,
  })
}
