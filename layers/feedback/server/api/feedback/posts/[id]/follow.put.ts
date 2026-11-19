import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { setFollowing } from '../../../../outcomes.ts'
import { validateFollowInput } from '../../../../../shared/outcome-input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const input = validated(validateFollowInput(await readBody(event)))
  return feedbackResponse(event, () =>
    setFollowing(actorId, feedbackParam(event, 'id'), input.following, requestId),
  )
})
