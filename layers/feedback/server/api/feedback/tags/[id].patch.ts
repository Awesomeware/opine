import { feedbackActor, feedbackResponse, validated, feedbackParam } from '../../../http.ts'
import { updateTag } from '../../../posts/tags.ts'
import { validateTagEditInput } from '../../../../shared/posts/tag-input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = validated(validateTagEditInput(await readBody(event)))
  const { actorId, requestId } = await feedbackActor(event, 'administrator')
  return feedbackResponse(event, updateTag(actorId, id, input, requestId))
})
