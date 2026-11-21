import { feedbackActor, feedbackParam, feedbackResponse, validated } from '../../../../http.ts'
import { correctCategory } from '../../../../review/category-correction.ts'
import { validateCategoryCorrectionInput } from '../../../../../shared/review/input.ts'
export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const input = validated(validateCategoryCorrectionInput(await readBody(event)))
  return feedbackResponse(event, () =>
    correctCategory(actorId, feedbackParam(event, 'id'), input, requestId),
  )
})
