import { ref } from 'vue'
import { type ContributionType } from '../../../shared/discussion/contribution-types'
import { validateCommentInput } from '../../../shared/discussion/input'
import { createComment } from '../api/discussion'
import { feedbackFailure, feedbackWriteError } from '../../api/errors'
import { startDiscordSignIn } from '../../../../auth/app/api/session'
import { useRequestScope } from '../../composables/useRequestScope'

/** Owns one mounted account/post form; remount on either change. */
export function useCommentComposer(
  props: { postId: string; owner: string | null },
  submitted: () => Promise<void>,
) {
  const route = useRoute()
  const body = ref('')
  const type = ref<ContributionType | ''>('')
  const busy = ref(false)
  const message = ref('')
  const fieldErrors = ref<Record<string, string>>({})
  const expired = ref(false)

  const scope = useRequestScope()

  async function signIn() {
    const error = await startDiscordSignIn(route.fullPath)
    if (scope.isActive()) {
      message.value = error
    }
  }

  async function submitComment() {
    if (busy.value || !props.owner) {
      return
    }
    fieldErrors.value = {}
    const parsed = validateCommentInput({ body: body.value, type: type.value })
    if (!parsed.success) {
      fieldErrors.value = parsed.fieldErrors
      message.value = 'Please check the highlighted field.'
      return
    }
    const payload = parsed.data

    busy.value = true
    message.value = ''

    try {
      const result = await createComment(props.postId, payload)
      if (!scope.isActive()) {
        return
      }

      body.value = ''
      type.value = ''
      await navigateTo({
        path: `/feedback/${props.postId}`,
        query: { ...route.query, response: undefined, comment: result.id },
        hash: `#comment-${result.id}`,
      })
      if (scope.isActive()) {
        await submitted()
      }
    } catch (failure) {
      if (scope.isActive()) {
        message.value = feedbackWriteError(failure)
        expired.value = feedbackFailure(failure).status === 401
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  return {
    body,
    type,
    busy,
    message,
    fieldErrors,
    expired,
    signIn,
    submitComment,
  }
}
