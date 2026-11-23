import type { FeedbackOutcome } from '../../../shared/review/contracts'
import type { OfficialResponseInput } from '../../../shared/review/input'

export function getOutcome(postId: string) {
  return $fetch<FeedbackOutcome>(`/api/feedback/posts/${postId}/outcome`)
}

export function publishResponse(postId: string, body: OfficialResponseInput) {
  return $fetch<{ id: string; version: number }>(`/api/feedback/posts/${postId}/responses`, {
    method: 'POST',
    body,
    retry: 0,
  })
}
