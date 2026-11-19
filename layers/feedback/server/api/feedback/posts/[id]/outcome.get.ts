import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { getOutcome } from '../../../../outcomes.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  return feedbackResponse(event, () => getOutcome(feedbackParam(event, 'id'), access?.user.id))
})
