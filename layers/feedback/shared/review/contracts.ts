import type { PostStatus } from '../status.ts'

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
  canModerate: boolean
  canRespond: boolean
}

export type PostLockResult = { lockedAt: string | null; canEdit: boolean }
export type PostArchiveResult = { archived: true }
