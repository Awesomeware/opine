import { fromNodeHeaders } from 'better-auth/node'
import { getAccess } from '../../../../../auth/server/access.ts'
import { validatePostInput } from '../../../../shared/post-input.ts'
import { createPost, PostingRateLimitError } from '../../../posts.ts'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const access = await getAccess(fromNodeHeaders(event.node.req.headers))
  if (!access) throw createError({ statusCode: 401, statusMessage: 'Sign in to share feedback.' })
  if (getHeader(event, 'origin') !== process.env.BETTER_AUTH_URL?.trim()) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid request origin.' })
  }
  const parsed = validatePostInput(await readBody(event))
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Check your feedback.',
      data: { fieldErrors: parsed.fieldErrors },
    })
  try {
    const post = await createPost(access.user.id, parsed.data)
    if (!post)
      throw createError({
        statusCode: 400,
        statusMessage: 'Choose an available category.',
        data: {
          fieldErrors: {
            categoryId: 'This category is no longer available. Choose another category.',
          },
        },
      })
    setResponseStatus(event, 201)
    return post
  } catch (error) {
    if (error instanceof PostingRateLimitError) {
      setResponseHeader(event, 'Retry-After', error.retryAfterSeconds)
      throw createError({ statusCode: 429, statusMessage: error.message })
    }
    throw error
  }
})
