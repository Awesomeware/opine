import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { getOutcome } from '../../../../review/outcome.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const access = await feedbackViewer(event)
  return feedbackResponse(event, getOutcome(id, access?.user.id))
})
