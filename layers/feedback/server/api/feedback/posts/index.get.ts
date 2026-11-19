import { parseListInput } from '../../../list-input.ts'
import { listPosts } from '../../../posts.ts'

export default defineEventHandler(async (event) => {
  const parsed = parseListInput(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.message })
  return listPosts(parsed.data)
})
