import { feedbackActor, feedbackResponse, validated, feedbackParam } from '../../../http.ts'
import { updateTag } from '../../../tags.ts'
import { validateTagEditInput } from '../../../../shared/tag-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const input = validated(validateTagEditInput(await readBody(event)))
  return feedbackResponse(event, () =>
    updateTag(actorId, feedbackParam(event, 'id'), input, requestId),
  )
})
