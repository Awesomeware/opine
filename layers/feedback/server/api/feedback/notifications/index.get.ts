import { feedbackViewer, feedbackResponse } from '../../../http.ts'
import { listNotifications } from '../../../subscriptions/inbox.ts'
import { parseNotificationListInput } from '../../../list-input.ts'

export default defineEventHandler(async (event) => {
  const parsed = parseNotificationListInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  const access = await feedbackViewer(event)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  return feedbackResponse(event, listNotifications(access.user.id, parsed.data))
})
