import type { FeedbackTag } from '../../../shared/posts/contracts'
import type { TagInput, TagEditInput } from '../../../shared/posts/tag-input'

export function getTags() {
  return $fetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
}

export function createTag(body: TagInput, headers: Record<string, string>) {
  return $fetch('/api/feedback/tags', { method: 'POST', body, headers, retry: 0 })
}

export function updateTag(id: string, body: TagEditInput, headers: Record<string, string>) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/tags/${id}`, {
    method: 'PATCH',
    body,
    headers,
    retry: 0,
  })
}
