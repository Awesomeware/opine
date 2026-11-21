import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { setFollowing } from '../../../../subscriptions/following.ts'
import { validateFollowInput } from '../../../../../shared/subscriptions/input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = validated(validateFollowInput(await readBody(event)))
  const { actorId, requestId } = await feedbackActor(event)
  return feedbackResponse(event, setFollowing(actorId, id, input.following, requestId))
})
