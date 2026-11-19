import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { publishResponse } from '../../../../../outcomes.ts'
import { validateOfficialResponseInput } from '../../../../../../shared/outcome-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const input = validated(validateOfficialResponseInput(await readBody(event)))
  const response = await feedbackResponse(event, () =>
    publishResponse(actorId, feedbackParam(event, 'id'), input, requestId),
  )
  setResponseStatus(event, 201)
  return response
})
