import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { correctCategory } from '../../../../review/category-correction.ts'
import { validateCategoryCorrectionInput } from '../../../../../shared/review/input.ts'

export default defineEventHandler(async (event) => {
  const id = feedbackParam(event, 'id')
  const input = validated(validateCategoryCorrectionInput(await readBody(event)))
  const actorId = await feedbackActor(event, 'community-manager')
  return feedbackResponse(event, correctCategory(actorId, id, input))
})
