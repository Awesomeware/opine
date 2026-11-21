import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../http.ts'
import { getReactions } from '../../../../discussion/reactions.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  return feedbackResponse(event, () => getReactions(feedbackParam(event, 'id'), access?.user.id))
})
