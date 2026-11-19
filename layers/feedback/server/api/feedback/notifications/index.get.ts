import { feedbackViewer, feedbackResponse } from '../../../http.ts'
import { listNotifications } from '../../../outcomes.ts'
import { parseNotificationListInput } from '../../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  const parsed = parseNotificationListInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () => listNotifications(access.user.id, parsed.data))
})
