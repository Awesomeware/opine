import type { FeedbackReactions, ReactionKind } from '../../../shared/discussion/contracts'

export type ReactionInput = { kind: ReactionKind | null }

export function getReactions(postId: string) {
  return $fetch<FeedbackReactions>(`/api/feedback/posts/${postId}/reactions`)
}

export function setReaction(postId: string, body: ReactionInput) {
  return $fetch(`/api/feedback/posts/${postId}/reactions`, {
    method: 'PUT',
    body,
    retry: 0,
  })
}
