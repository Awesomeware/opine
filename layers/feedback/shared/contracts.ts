import type { ContributionType } from './contribution-types.ts'
import type { PostStatus } from './status.ts'

export type FeedbackCategory = { id: string; slug: string; name: string; isActive: boolean }
export type FeedbackTag = { id: string; name: string; isActive: boolean; version: number }
export type FeedbackPostSummary = {
  tags: FeedbackTag[]
  id: string
  title: string
  excerpt: string
  status: PostStatus
  createdAt: string
  author: { name: string }
  category: { id: string; slug: string; name: string }
}
export type FeedbackPost = Omit<FeedbackPostSummary, 'excerpt'> & {
  description: string
  desiredImprovement: string | null
  version: number
  editedAt: string | null
  canEdit: boolean
  updatedAt: string
}
export type FeedbackPage = { posts: FeedbackPostSummary[]; nextCursor: string | null }

export type ReactionKind = 'agree' | 'disagree'
export type FeedbackReactions = { agree: number; disagree: number; mine: ReactionKind | null }
export type FeedbackComment = {
  id: string
  postId: string
  body: string
  type: ContributionType | null
  author: { name: string }
  createdAt: string
  editedAt: string | null
  version: number
  canEdit: boolean
}

export type OfficialResponse = {
  id: string
  postId: string
  body: string
  author: { name: string }
  createdAt: string
  previousStatus: PostStatus | null
  status: PostStatus | null
}
export type FeedbackOutcome = {
  status: PostStatus
  version: number
  latestResponse: OfficialResponse | null
  statusResponse: OfficialResponse | null
  following: boolean
  canRespond: boolean
}
export type DiscussionEntry =
  | { kind: 'comment'; comment: FeedbackComment }
  | { kind: 'response'; response: OfficialResponse }
export type FeedbackDiscussionPage = { entries: DiscussionEntry[]; nextCursor: string | null }
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
