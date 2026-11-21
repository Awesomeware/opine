import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { editComment } from '../../../../../discussion/comments.ts'
import { validateCommentEditInput } from '../../../../../../shared/discussion/input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const commentId = feedbackParam(event, 'commentId')
  const input = validated(validateCommentEditInput(await readBody(event)))
  return feedbackResponse(event, () => editComment(actorId, id, commentId, input, requestId))
})
