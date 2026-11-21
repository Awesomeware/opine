import { feedbackActor, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { archivePost } from '../../../../review/moderation.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const actorId = await feedbackActor(event, 'community-manager')
  return feedbackResponse(event, archivePost(actorId, id))
})
