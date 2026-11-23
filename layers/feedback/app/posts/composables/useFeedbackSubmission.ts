import { computed, reactive, ref, watch } from 'vue'
import { authClient } from '../../../../auth/app/auth-client'
import { startDiscordSignIn } from '../../../../auth/app/api/session'
import { useRequestScope } from '../../composables/useRequestScope'
import { createPost } from '../api/posts'
import { getTags } from '../api/tags'
import { feedbackFailure } from '../../api/errors'
import type { SubmissionForm } from '../utils/post-editor-input'
import { validatePostInput } from '../../../shared/posts/input'

/** Owns the mounted form; ignores completion after disposal or a session identity change. */
export function useFeedbackSubmission() {
  const session = authClient.useSession()
  const {
    data: tagData,
    pending: tagsPending,
    error: tagsError,
    refresh: refreshTags,
  } = useAsyncData('submission-tags', getTags)
  const form = reactive<SubmissionForm>({
    title: '',
    description: '',
    desiredImprovement: '',
    tagIds: [],
  })
  const fieldErrors = ref<Partial<Record<keyof typeof form, string>>>({})
  const saving = ref(false)
  const checkingSession = ref(false)
  const signingIn = ref(false)
  const busy = computed(() => saving.value || checkingSession.value || signingIn.value)
  const scope = useRequestScope()
  const signInScope = useRequestScope()
  const sessionScope = useRequestScope()
  const message = ref('')
  const formOwner = ref<string | null>(null)

  watch(
    () => session.value.data?.user.id,
    (id) => {
      scope.startRequest()
      signInScope.startRequest()
      sessionScope.startRequest()
      formOwner.value = id ?? null

      message.value = ''
      saving.value = false
      signingIn.value = false
      checkingSession.value = false
      Object.assign(form, {
        title: '',
        description: '',
        desiredImprovement: '',
        tagIds: [],
      })
      fieldErrors.value = {}
    },
    { immediate: true },
  )

  async function signIn() {
    const isCurrent = signInScope.startRequest()
    signingIn.value = true
    message.value = ''
    const error = await startDiscordSignIn('/feedback/new', '/feedback/new?signIn=failed')
    if (isCurrent()) {
      message.value = error
      signingIn.value = false
    }
  }

  async function retrySession() {
    const isCurrent = sessionScope.startRequest()
    checkingSession.value = true
    try {
      await session.value.refetch()
    } catch {
      if (isCurrent()) {
        message.value = 'Unable to check your session. Please try again.'
      }
    } finally {
      if (isCurrent()) {
        checkingSession.value = false
      }
    }
  }

  async function publish() {
    if (busy.value) {
      return
    }

    fieldErrors.value = {}
    message.value = ''

    const result = validatePostInput(form)
    if (!result.success) {
      fieldErrors.value = result.fieldErrors
      message.value = 'Please check the highlighted fields.'
      return
    }

    if (!formOwner.value) {
      return
    }

    const isCurrent = scope.startRequest()
    saving.value = true

    try {
      const post = await createPost(result.data)
      if (!isCurrent()) {
        return
      }

      return post.id
    } catch (error: unknown) {
      if (!isCurrent()) {
        return
      }

      const failure = feedbackFailure(error)
      if (failure.status === 400 && Object.keys(failure.fieldErrors).length) {
        fieldErrors.value = failure.fieldErrors
        message.value = 'Please check the highlighted fields.'
        if (fieldErrors.value.tagIds) {
          await refreshTags()
          if (!isCurrent()) {
            return
          }
        }
      } else if (failure.status === 400) {
        message.value = 'Check your selected tags before submitting again.'
        fieldErrors.value.tagIds = 'Only active tags can be added. Remove any unavailable tags.'
        await refreshTags()
      } else if (failure.status === 401) {
        message.value = 'Your session has expired. Sign in again to submit your feedback.'
        try {
          await session.value.refetch()
        } catch {
          /* The expired-session message remains actionable. */
        }
      } else if (failure.status === 429) {
        message.value = 'You are posting too quickly. Please wait before trying again.'
      } else {
        message.value =
          'Unable to confirm submission. Check the feedback list before submitting again.'
      }
    } finally {
      if (isCurrent()) {
        saving.value = false
      }
    }
  }

  function clearTags() {
    form.tagIds = []
  }

  return {
    session,
    tagData,
    tagsPending,
    tagsError,
    refreshTags,
    form,
    fieldErrors,
    busy,
    message,
    signIn,
    retrySession,
    publish,
    clearTags,
  }
}
