import { feedbackViewer, feedbackResponse } from '../../http.ts'
import { listReviewQueue } from '../../outcomes.ts'
import { parseReviewInput } from '../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  const parsed = parseReviewInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () => listReviewQueue(access.user.id, parsed.data))
})
