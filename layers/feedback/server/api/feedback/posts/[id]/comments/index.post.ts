import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { createComment } from '../../../../../discussion/comments.ts'
import { validateCommentInput } from '../../../../../../shared/discussion/input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const body: unknown = await readBody(event)
  const input = validated(validateCommentInput(body))
  const comment = await feedbackResponse(event, () => createComment(actorId, id, input, requestId))
  setResponseStatus(event, 201)
  return comment
})
