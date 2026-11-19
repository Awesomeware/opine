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
  updatedAt: string
}
export type FeedbackPage = { posts: FeedbackPostSummary[]; nextCursor: string | null }
