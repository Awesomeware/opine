import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../../http.ts'
import { listComments } from '../../../../../participation.ts'
import { parseListInput } from '../../../../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  const query = getQuery(event)
  if (Object.keys(query).some((key) => !['cursor', 'limit'].includes(key)))
    throw createError({ statusCode: 400, statusMessage: 'Invalid comment pagination.' })
  const parsed = parseListInput(query)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () =>
    listComments(feedbackParam(event, 'id'), parsed.data, access?.user.id),
  )
})
