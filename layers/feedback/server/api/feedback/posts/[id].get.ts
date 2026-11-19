import { isUuid } from '../../../../shared/post-input.ts'
import { getPost } from '../../../posts.ts'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const post = isUuid(id) ? await getPost(id) : undefined
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Feedback not found.' })
  return { post }
})
