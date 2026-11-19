import { feedbackParam, feedbackViewer } from '../../../../../http.ts'
import { getComment } from '../../../../../participation.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  const comment = await getComment(
    feedbackParam(event, 'id'),
    feedbackParam(event, 'commentId'),
    access?.user.id,
  )
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comment not found.' })
  return { comment }
})
