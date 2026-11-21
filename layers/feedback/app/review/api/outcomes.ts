import type { FeedbackOutcome } from '../../../shared/review/contracts'
import type { CategoryCorrectionInput, OfficialResponseInput } from '../../../shared/review/input'

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

export function correctCategory(postId: string, body: CategoryCorrectionInput) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/posts/${postId}/category`, {
    method: 'PATCH',
    body,
    retry: 0,
  })
}

export function publishResponse(postId: string, body: OfficialResponseInput) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/posts/${postId}/responses`, {
    method: 'POST',
    body,
    retry: 0,
  })
}
