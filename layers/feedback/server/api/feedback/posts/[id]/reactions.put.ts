import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { setReaction } from '../../../../discussion/reactions.ts'
import { validateReactionInput } from '../../../../../shared/discussion/input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = validated(validateReactionInput(await readBody(event)))
  const actorId = await feedbackActor(event)
  return feedbackResponse(event, setReaction(actorId, id, input.kind))
})
