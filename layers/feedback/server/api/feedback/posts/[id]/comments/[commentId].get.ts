import { feedbackParam, feedbackViewer } from '../../../../../http.ts'
import { getComment } from '../../../../../discussion/comments.ts'

export default defineEventHandler(async (event) => {
  const commentId = feedbackParam(event, 'commentId')
  const id = feedbackParam(event, 'id')
  const access = await feedbackViewer(event)
  const comment = await getComment(id, commentId, access?.user.id)
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comment not found.' })
  return { comment }
})
