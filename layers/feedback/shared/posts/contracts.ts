import type { PostStatus } from '../status.ts'

export type FeedbackTag = {
  id: string
  name: string
  icon: string | null
  isActive: boolean
  version: number
}
export type FeedbackPostSummary = {
  tags: FeedbackTag[]
  id: string
  title: string
  excerpt: string
  lockedAt: string | null
  status: PostStatus
  createdAt: string
  author: { name: string }
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
