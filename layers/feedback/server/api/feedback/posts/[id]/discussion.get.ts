import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { listDiscussion } from '../../../../discussion/feed.ts'
import { parseDiscussionListInput } from '../../../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  const parsed = parseDiscussionListInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () =>
    listDiscussion(feedbackParam(event, 'id'), parsed.data, access?.user.id),
  )
})
