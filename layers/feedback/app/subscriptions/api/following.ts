export function changeFollowing(postId: string, body: { following: boolean }) {
  return $fetch(`/api/feedback/posts/${postId}/follow`, { method: 'PUT', body, retry: 0 })
}
