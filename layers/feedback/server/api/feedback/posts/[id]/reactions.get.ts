import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../http.ts'
import { getReactions } from '../../../../discussion/reactions.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const access = await feedbackViewer(event)
  return feedbackResponse(event, getReactions(id, access?.user.id))
})
