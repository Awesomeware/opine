import { feedbackParam, feedbackViewer } from '../../../http.ts'
import { getPost } from '../../../posts/queries.ts'
export default defineEventHandler(async (event) => {
  const access = await feedbackViewer(event)
  const post = await getPost(feedbackParam(event, 'id'), access?.user.id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Feedback not found.' })
  return { post }
})
