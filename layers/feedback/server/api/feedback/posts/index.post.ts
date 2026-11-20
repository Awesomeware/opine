import { validatePostInput } from '../../../../shared/post-input.ts'
import { createPost } from '../../../posts.ts'
import { feedbackActor, feedbackResponse } from '../../../http.ts'

export default defineEventHandler(async (event) => {
  const { actorId, requestId } = await feedbackActor(event)
  const parsed = validatePostInput(await readBody(event))
  if (!parsed.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Check your feedback.',
      data: { fieldErrors: parsed.fieldErrors },
    })
  const post = await feedbackResponse(event, () => createPost(actorId, parsed.data, requestId))
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
