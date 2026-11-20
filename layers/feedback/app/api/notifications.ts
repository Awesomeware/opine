import type { FeedbackNotificationsPage } from '../../shared/contracts'

export function getNotifications(unread: boolean, cursor?: string) {
  return $fetch<FeedbackNotificationsPage>('/api/feedback/notifications', {
    query: { unread: unread ? 'true' : undefined, cursor },
  })
}

export function markNotificationRead(id: string, headers: Record<string, string>) {
  return $fetch(`/api/feedback/notifications/${id}`, {
    method: 'PATCH',
    body: { read: true },
    headers,
    retry: 0,
  })
}
