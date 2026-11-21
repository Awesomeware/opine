import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../../http.ts'
import { getOfficialResponse } from '../../../../../review/outcome.ts'
export default defineEventHandler(async (event) => {
  await feedbackViewer(event)
  return feedbackResponse(event, async () => {
    const response = await getOfficialResponse(
      feedbackParam(event, 'id'),
      feedbackParam(event, 'responseId'),
    )
    if (!response)
      throw createError({ statusCode: 404, statusMessage: 'Official response not found.' })
    return { response }
  })
})
