import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { setReaction } from '../../../../discussion/reactions.ts'
import { validateReactionInput } from '../../../../../shared/discussion/input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const id = feedbackParam(event, 'id')
  const input = validated(validateReactionInput(await readBody(event)))
  return feedbackResponse(event, () => setReaction(actorId, id, input.kind, requestId))
})
