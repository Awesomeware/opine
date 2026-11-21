import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { listDiscussion } from '../../../../discussion/feed.ts'
import { parseDiscussionListInput } from '../../../../list-input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const parsed = parseDiscussionListInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const access = await feedbackViewer(event)
  return feedbackResponse(event, listDiscussion(id, parsed.data, access?.user.id))
})
