import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../../http.ts'
import { listComments } from '../../../../../participation.ts'
import { parseCommentListInput } from '../../../../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  const query = getQuery(event)
  const parsed = parseCommentListInput(query)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () =>
    listComments(feedbackParam(event, 'id'), parsed.data, access?.user.id),
  )
})
