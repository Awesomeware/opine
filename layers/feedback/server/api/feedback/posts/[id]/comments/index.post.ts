import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../../http.ts'
import { createComment, replayLegacyComment } from '../../../../../participation.ts'
import {
  validateCommentInput,
  validateLegacyCommentInput,
} from '../../../../../../shared/participation-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const body: unknown = await readBody(event)
  const legacy = validateLegacyCommentInput(body)
  if (legacy.success) {
    const recovered = await feedbackResponse(event, () =>
      replayLegacyComment(actorId, id, legacy.data, requestId),
    )
    if (recovered) {
      setResponseStatus(event, 201)
      return recovered
    }
  }
  const input = validated(validateCommentInput(body))
  const comment = await feedbackResponse(event, () => createComment(actorId, id, input, requestId))
  setResponseStatus(event, 201)
  return comment
})
