import type { PostArchiveResult, PostLockResult } from '../../../shared/review/contracts'

export function setPostLock(postId: string, locked: boolean) {
  return $fetch<PostLockResult>(`/api/feedback/posts/${encodeURIComponent(postId)}/lock`, {
    method: 'PUT',
    body: { locked },
    retry: 0,
  })
}

export function archivePost(postId: string) {
  return $fetch<PostArchiveResult>(`/api/feedback/posts/${encodeURIComponent(postId)}/archive`, {
    method: 'POST',
    body: {},
    retry: 0,
  })
}
