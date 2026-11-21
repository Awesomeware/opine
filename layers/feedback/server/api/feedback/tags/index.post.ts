import { feedbackActor, feedbackResponse, validated } from '../../../http.ts'
import { createTag } from '../../../posts/tags.ts'
import { validateTagInput } from '../../../../shared/posts/tag-input.ts'

export default defineEventHandler(async (event) => {
  const input = validated(validateTagInput(await readBody(event)))
  const { actorId, requestId } = await feedbackActor(event, 'administrator')
  setResponseStatus(event, 201)
  return feedbackResponse(event, createTag(actorId, input, requestId))
})
