import { feedbackViewer, feedbackParam, feedbackResponse } from '../../../../http.ts'
import { listCategoryHistory } from '../../../../review/category-correction.ts'
import { parsePaginationInput } from '../../../../../../../server/pagination.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const parsed = parsePaginationInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  await feedbackViewer(event, 'community-manager')
  return feedbackResponse(event, listCategoryHistory(id, parsed.data))
})
