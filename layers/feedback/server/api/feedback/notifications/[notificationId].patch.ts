import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../http.ts'
import { markNotificationRead } from '../../../subscriptions/inbox.ts'
import { validateReadInput } from '../../../../shared/subscriptions/input.ts'

export default defineEventHandler(async (event) => {
  const notificationId = feedbackParam(event, 'notificationId')
  validated(validateReadInput(await readBody(event)))
  const actorId = await feedbackActor(event)
  return feedbackResponse(event, markNotificationRead(actorId, notificationId))
})
