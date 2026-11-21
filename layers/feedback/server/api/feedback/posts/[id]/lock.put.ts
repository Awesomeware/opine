import { feedbackActor, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { setPostLocked } from '../../../../review/moderation.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = await readBody(event)
  if (!input || typeof input.locked !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Choose whether to lock the feedback.' })
  }
  const actorId = await feedbackActor(event, 'community-manager')
  return feedbackResponse(event, setPostLocked(actorId, id, input.locked))
})
