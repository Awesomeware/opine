import type { FeedbackNotificationsPage } from '../../../shared/subscriptions/contracts'

export function getNotifications(unread: boolean, cursor?: string) {
  return $fetch<FeedbackNotificationsPage>('/api/feedback/notifications', {
    query: { unread: unread ? 'true' : undefined, cursor },
  })
}

export function markNotificationRead(id: string) {
  return $fetch(`/api/feedback/notifications/${id}`, {
    method: 'PATCH',
    body: { read: true },
    retry: 0,
  })
}
