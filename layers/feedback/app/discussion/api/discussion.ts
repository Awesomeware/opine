import type { CommentInput } from '../../../shared/discussion/input'
import type { FeedbackDiscussionPage } from '../../../shared/discussion/contracts'
import type { OfficialResponse } from '../../../shared/review/contracts'
import type { ContributionType } from '../../../shared/discussion/contribution-types'

export function getDiscussion(postId: string, type?: ContributionType | 'team', cursor?: string) {
  return $fetch<FeedbackDiscussionPage>(`/api/feedback/posts/${postId}/discussion`, {
    query: { ...(type ? { type } : {}), ...(cursor ? { cursor } : {}) },
  })
}

export function getLinkedResponse(postId: string, id: string) {
  return $fetch<{ response: OfficialResponse }>(
    `/api/feedback/posts/${postId}/responses/${encodeURIComponent(id)}`,
  )
}

export function createComment(postId: string, body: CommentInput, headers: Record<string, string>) {
  return $fetch<{ id: string }>(`/api/feedback/posts/${postId}/comments`, {
    method: 'POST',
    body,
    headers,
    retry: 0,
  })
}
