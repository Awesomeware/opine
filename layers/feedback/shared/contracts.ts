import type { PostStatus } from './status.ts'

export type FeedbackCategory = { id: string; slug: string; name: string; isActive: boolean }
export type FeedbackPostSummary = {
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
  author: { name: string }
  createdAt: string
  editedAt: string | null
  version: number
  canEdit: boolean
}
export type FeedbackCommentsPage = { comments: FeedbackComment[]; nextCursor: string | null }
