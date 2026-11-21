import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { publishResponse } from '../../../../../review/publication.ts'
import { validateOfficialResponseInput } from '../../../../../../shared/review/input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = validated(validateOfficialResponseInput(await readBody(event)))
  const actorId = await feedbackActor(event, 'community-manager')
  const response = await feedbackResponse(event, publishResponse(actorId, id, input))
  setResponseStatus(event, 201)
  return response
})
