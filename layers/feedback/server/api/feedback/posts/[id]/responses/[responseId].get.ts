import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../../http.ts'
import { getOfficialResponse } from '../../../../../review/outcome.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const responseId = feedbackParam(event, 'responseId')
  await feedbackViewer(event)
  const response = await feedbackResponse(event, getOfficialResponse(id, responseId))
  if (!response)
    throw createError({ statusCode: 404, statusMessage: 'Official response not found.' })
  return { response }
})
