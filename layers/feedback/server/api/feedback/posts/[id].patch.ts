import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../http.ts'
import { editPost } from '../../../posts/editing.ts'
import { validatePostEditInput } from '../../../../shared/posts/input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const input = validated(validatePostEditInput(await readBody(event)))
  return feedbackResponse(event, () => editPost(actorId, id, input, requestId))
})
