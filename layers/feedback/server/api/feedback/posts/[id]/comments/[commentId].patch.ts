import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { editComment } from '../../../../../discussion/comments.ts'
import { validateCommentEditInput } from '../../../../../../shared/discussion/input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const commentId = feedbackParam(event, 'commentId')
  const input = validated(validateCommentEditInput(await readBody(event)))
  const { actorId, requestId } = await feedbackActor(event)
  return feedbackResponse(event, editComment(actorId, id, commentId, input, requestId))
})
