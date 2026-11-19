import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../http.ts'
import { markNotificationRead } from '../../../outcomes.ts'
import { validateReadInput } from '../../../../shared/outcome-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  validated(validateReadInput(await readBody(event)))
  return feedbackResponse(event, () =>
    markNotificationRead(actorId, feedbackParam(event, 'notificationId'), requestId),
  )
})
