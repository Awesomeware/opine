import type { PostStatus } from '../status.ts'

export type FeedbackNotification = {
  id: string
  postId: string
  postTitle: string
  responseId: string
  createdAt: string
  readAt: string | null
  status: PostStatus | null
}
export type FeedbackNotificationsPage = {
  notifications: FeedbackNotification[]
  nextCursor: string | null
  unreadCount: number
}
