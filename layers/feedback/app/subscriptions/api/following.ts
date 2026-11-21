export function changeFollowing(
  postId: string,
  body: { following: boolean },
  headers: Record<string, string>,
) {
  return $fetch(`/api/feedback/posts/${postId}/follow`, { method: 'PUT', body, headers, retry: 0 })
}
