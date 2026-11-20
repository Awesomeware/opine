import type { FeedbackReactions, ReactionKind } from '../../shared/contracts'

export type ReactionInput = { kind: ReactionKind | null }

export function getReactions(postId: string) {
  return $fetch<FeedbackReactions>(`/api/feedback/posts/${postId}/reactions`)
}

export function setReaction(postId: string, body: ReactionInput, headers: Record<string, string>) {
  return $fetch(`/api/feedback/posts/${postId}/reactions`, {
    method: 'PUT',
    body,
    headers,
    retry: 0,
  })
}
