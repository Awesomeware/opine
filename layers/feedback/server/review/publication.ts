import { desc, eq } from 'drizzle-orm'
import type { OfficialResponseInput } from '../../shared/review/input.ts'
import { lockPost, updatePostWorkflow } from '../posts/workflow.ts'
import { feedbackComment, feedbackOfficialResponse } from '../schema.ts'
import { notifyFollowers } from '../subscriptions/notifications.ts'
import { feedbackWrite } from '../writes.ts'
import { checkWorkflowVersion, requireManager } from './guards.ts'

export async function publishResponse(
  actorId: string,
  postId: string,
  input: OfficialResponseInput,
  requestId: string,
) {
  return feedbackWrite(
    actorId,
    requestId,
    'publish-response',
    { postId, ...input },
    (transaction) => requireManager(actorId, transaction),
    async (transaction) => {
      const post = await lockPost(transaction, postId)
      checkWorkflowVersion(post.workflowVersion, input.version)
      const [latest] = await transaction
        .select({ createdAt: feedbackOfficialResponse.createdAt })
        .from(feedbackOfficialResponse)
        .where(eq(feedbackOfficialResponse.postId, postId))
        .orderBy(desc(feedbackOfficialResponse.createdAt))
        .limit(1)
      const [latestComment] = await transaction
        .select({ createdAt: feedbackComment.createdAt })
        .from(feedbackComment)
        .where(eq(feedbackComment.postId, postId))
        .orderBy(desc(feedbackComment.createdAt))
        .limit(1)
      // The post lock orders publication after prior comments, including rounded timestamps.
      const createdAt = new Date(
        Math.max(
          Date.now(),
          (latest?.createdAt.getTime() ?? 0) + 1,
          (latestComment?.createdAt.getTime() ?? 0) + 1,
        ),
      )
      const changed = input.status !== undefined && input.status !== post.status
      const [response] = await transaction
        .insert(feedbackOfficialResponse)
        .values({
          postId,
          authorId: actorId,
          body: input.body,
          createdAt,
          previousStatus: changed ? post.status : null,
          status: changed ? input.status : null,
        })
        .returning({ id: feedbackOfficialResponse.id })
      const version = post.workflowVersion + 1
      await updatePostWorkflow(transaction, postId, version, {
        status: input.status ?? post.status,
      })
      await notifyFollowers(transaction, postId, response!.id, createdAt)
      return { id: response!.id, version }
    },
    { env: 'FEEDBACK_RESPONSE_MAX', fallback: 20 },
  )
}
