import type { PrivilegedRole } from '../../layers/auth/shared/roles.ts'
import type { getDatabase } from '../db/index.ts'
import { eventLog } from './schema.ts'

type Transaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0]
type PostDetails = { postId: string }
type CommentDetails = PostDetails & { commentId: string; version: number }
type Reaction = 'agree' | 'disagree' | null

type EventDetails = {
  'post.created': PostDetails
  'post.edited': PostDetails & { version: number; changedFields: string[] }
  'post.locked': PostDetails
  'post.unlocked': PostDetails
  'post.archived': PostDetails
  'comment.created': CommentDetails
  'comment.edited': CommentDetails & { changedFields: string[] }
  'official_response.published': PostDetails & { responseId: string }
  'reaction.changed': PostDetails & { from: Reaction; to: Reaction }
  'post.followed': PostDetails
  'post.unfollowed': PostDetails
  'tag.created': { tagId: string; version: number }
  'tag.updated': { tagId: string; version: number; changedFields: string[] }
  'role.granted': { userId: string; role: PrivilegedRole }
  'role.revoked': { userId: string; role: PrivilegedRole }
}

type ApplicationEvent = {
  [Type in keyof EventDetails]: {
    type: Type
    actorId: string | null
    details: EventDetails[Type]
  }
}[keyof EventDetails]

// The caller owns the transaction, so the action and its record commit together.
// Deliberately accepts metadata only: event records are not content edit history.
export async function appendEvent(transaction: Transaction, event: ApplicationEvent) {
  await transaction.insert(eventLog).values({
    eventType: event.type,
    actorId: event.actorId,
    details: event.details,
  })
}
