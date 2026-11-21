import { sql } from 'drizzle-orm'
import { feedbackFollow, feedbackNotification } from '../schema.ts'
import type { FeedbackTransaction } from '../writes.ts'

// Publication holds the visible, unlocked post through delivery and commit.
// Keep delivery inside its transaction without loading the follower list.
export async function notifyFollowers(
  transaction: FeedbackTransaction,
  postId: string,
  responseId: string,
  createdAt: Date,
) {
  await transaction.execute(sql`
    insert into ${feedbackNotification} (user_id, response_id, created_at)
    select ${feedbackFollow.userId}, ${responseId}::uuid, ${createdAt.toISOString()}::timestamptz
    from ${feedbackFollow}
    where ${feedbackFollow.postId} = ${postId}::uuid
  `)
}
