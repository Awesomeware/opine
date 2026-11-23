import type { FeedbackPage } from '../../../shared/posts/contracts'
import type { PostStatus } from '../../../shared/status'

export type ReviewFilters = { tagId: string; status: PostStatus | 'all'; followUp: boolean }

export function getReviewQueue(filters: ReviewFilters, cursor?: string) {
  return $fetch<FeedbackPage>('/api/feedback/review', {
    query: {
      tagId: filters.tagId || undefined,
      status: filters.status,
      followUp: filters.followUp ? 'true' : undefined,
      cursor,
    },
  })
}
