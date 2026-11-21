import { feedbackViewer, feedbackResponse } from '../../http.ts'
import { listReviewQueue } from '../../review/queue.ts'
import { parseReviewInput } from '../../list-input.ts'

export default defineEventHandler(async (event) => {
  const parsed = parseReviewInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  await feedbackViewer(event, 'community-manager')
  return feedbackResponse(event, listReviewQueue(parsed.data))
})
