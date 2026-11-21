import { validatePostInput } from '../../../../shared/posts/input.ts'
import { createPost } from '../../../posts/creation.ts'
import { feedbackActor, feedbackResponse } from '../../../http.ts'

export default defineEventHandler(async (event) => {
  const parsed = validatePostInput(await readBody(event))
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Check your feedback.',
      data: { fieldErrors: parsed.fieldErrors },
    })
  const { actorId, requestId } = await feedbackActor(event)
  const post = await feedbackResponse(event, createPost(actorId, parsed.data, requestId))
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
})
