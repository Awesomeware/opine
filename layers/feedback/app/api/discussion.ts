import type {
  FeedbackComment,
  FeedbackDiscussionPage,
  OfficialResponse,
} from '../../shared/contracts'
import type { ContributionType } from '../../shared/contribution-types'

export function getDiscussion(postId: string, type?: ContributionType | 'team', cursor?: string) {
  return $fetch<FeedbackDiscussionPage>(`/api/feedback/posts/${postId}/discussion`, {
    query: { ...(type ? { type } : {}), ...(cursor ? { cursor } : {}) },
  })
}

export function getLinkedComment(postId: string, id: string) {
  return $fetch<{ comment: FeedbackComment }>(
    `/api/feedback/posts/${postId}/comments/${encodeURIComponent(id)}`,
  )
}

export function getLinkedResponse(postId: string, id: string) {
  return $fetch<{ response: OfficialResponse }>(
    `/api/feedback/posts/${postId}/responses/${encodeURIComponent(id)}`,
  )
}

/** A body-only payload may recover a historical receipt, but cannot create a new comment. */
export function createComment(
  postId: string,
  body: { body: string; type?: ContributionType },
  headers: Record<string, string>,
) {
  return $fetch<{ id: string }>(`/api/feedback/posts/${postId}/comments`, {
    method: 'POST',
    body,
    headers,
    retry: 0,
  })
}
