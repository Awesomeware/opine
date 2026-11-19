import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { editComment } from '../../../../../participation.ts'
import { validateCommentEditInput } from '../../../../../../shared/participation-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const commentId = feedbackParam(event, 'commentId')
  const input = validated(validateCommentEditInput(await readBody(event)))
  return feedbackResponse(event, () => editComment(actorId, id, commentId, input, requestId))
})
