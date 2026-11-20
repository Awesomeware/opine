import type { FeedbackOutcome } from '../../shared/contracts'
import type { CategoryCorrectionInput, OfficialResponseInput } from '../../shared/outcome-input'

export type CategoryHistoryPage = {
  changes: {
    id: string
    previousCategoryId: string
    categoryId: string
    actor: { name: string }
    createdAt: string
  }[]
  nextCursor: string | null
}

export function getOutcome(postId: string) {
  return $fetch<FeedbackOutcome>(`/api/feedback/posts/${postId}/outcome`)
}

export function getCategoryHistory(postId: string, cursor?: string) {
  return $fetch<CategoryHistoryPage>(`/api/feedback/posts/${postId}/category-history`, {
    query: cursor ? { cursor } : {},
  })
}

export function correctCategory(
  postId: string,
  body: CategoryCorrectionInput,
  headers: Record<string, string>,
) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/posts/${postId}/category`, {
    method: 'PATCH',
    body,
    headers,
    retry: 0,
  })
}

export function publishResponse(
  postId: string,
  body: OfficialResponseInput,
  headers: Record<string, string>,
) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/posts/${postId}/responses`, {
    method: 'POST',
    body,
    headers,
    retry: 0,
  })
}

export function changeFollowing(
  postId: string,
  body: { following: boolean },
  headers: Record<string, string>,
) {
  return $fetch(`/api/feedback/posts/${postId}/follow`, { method: 'PUT', body, headers, retry: 0 })
}
