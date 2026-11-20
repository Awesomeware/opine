import { feedbackActor, feedbackResponse, validated } from '../../../http.ts'
import { createTag } from '../../../tags.ts'
import { validateTagInput } from '../../../../shared/tag-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const input = validated(validateTagInput(await readBody(event)))
  setResponseStatus(event, 201)
  return feedbackResponse(event, () => createTag(actorId, input, requestId))
})
