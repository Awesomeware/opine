import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../http.ts'
import { getReactions } from '../../../../participation.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  return feedbackResponse(event, () => getReactions(feedbackParam(event, 'id'), access?.user.id))
})
