import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { listCategoryHistory } from '../../../../review/category-correction.ts'
import { parsePaginationInput } from '../../../../list-input.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  const parsed = parsePaginationInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return feedbackResponse(event, () =>
    listCategoryHistory(access.user.id, feedbackParam(event, 'id'), parsed.data),
  )
})
