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
  const actorId = await feedbackActor(event)
  const post = await feedbackResponse(event, createPost(actorId, parsed.data))
  setResponseStatus(event, 201)
  return post
})
