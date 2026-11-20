import { computed, reactive, ref, watch } from 'vue'
import { authClient } from '../../../auth/app/auth-client'
import { startDiscordSignIn } from '../../../auth/app/api/session'
import { useFeedbackWrite } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'
import { getCategories, createPost } from '../api/posts'
import { getTags } from '../api/tags'
import { feedbackFailure } from '../api/errors'
import type { SubmissionForm } from '../utils/editor-input'
import { validatePostInput } from '../../shared/post-input'

/** Owns the mounted form; ignores completion after disposal or a session identity change. */
export function useFeedbackSubmission() {
  const session = authClient.useSession()
  const {
    data: categoryData,
    pending: categoriesPending,
    error: categoriesError,
    refresh,
  } = useAsyncData('submission-categories', getCategories)
  const categories = computed(
    () => categoryData.value?.categories.filter((category) => category.isActive) ?? [],
  )
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
    categoryId: '',
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
  const write = useFeedbackWrite()

  watch(
    () => session.value.data?.user.id,
    (id) => {
      scope.startRequest()
      signInScope.startRequest()
      sessionScope.startRequest()
      formOwner.value = id ?? null
      write.complete()
      message.value = ''
      saving.value = false
      signingIn.value = false
      checkingSession.value = false
      Object.assign(form, {
        title: '',
        description: '',
        desiredImprovement: '',
        categoryId: '',
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
      const post = await createPost(result.data, write.headers(result.data))
      if (!isCurrent()) {
        return
      }

      write.complete()

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
        if (fieldErrors.value.categoryId) {
          await refresh()
          if (!isCurrent()) {
            return
          }
          if (
            !categoriesError.value &&
            !categories.value.some((category) => category.id === form.categoryId)
          ) {
            form.categoryId = ''
          }
        }
      } else if (failure.status === 400) {
        message.value = 'Check your selected tags and category before submitting again.'
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
          'Unable to confirm submission. Please try again. Your text remains in this form.'
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
    categories,
    categoriesPending,
    categoriesError,
    refresh,
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
