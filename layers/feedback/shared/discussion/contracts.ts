import type { ContributionType } from './contribution-types.ts'
import type { OfficialResponse } from '../review/contracts.ts'

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

export type DiscussionEntry =
  | { kind: 'comment'; comment: FeedbackComment }
  | { kind: 'response'; response: OfficialResponse }
export type FeedbackDiscussionPage = { entries: DiscussionEntry[]; nextCursor: string | null }
