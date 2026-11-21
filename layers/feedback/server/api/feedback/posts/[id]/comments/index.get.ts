import { feedbackParam, feedbackResponse, feedbackViewer } from '../../../../../http.ts'
import { listComments } from '../../../../../discussion/comments.ts'
import { parseCommentListInput } from '../../../../../list-input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const query = getQuery(event)
  const parsed = parseCommentListInput(query)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const access = await feedbackViewer(event)
  return feedbackResponse(event, listComments(id, parsed.data, access?.user.id))
})
