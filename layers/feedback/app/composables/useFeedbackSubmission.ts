import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { authClient } from '../../../auth/app/auth-client'
import { startDiscordSignIn } from '../../../auth/app/api/session'
import { useFeedbackWrite } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'
import { getCategories, createPost } from '../api/posts'
import { getTags } from '../api/tags'
import { feedbackFailure } from '../api/errors'
import { readStoredValue, writeStoredValue, removeStoredValue } from '../utils/stored-input'
import { parseSubmissionDraft, submissionInput, type SubmissionForm } from '../utils/editor-input'

/** Owns account-scoped drafts; ignores completion after disposal or a session identity change. */
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
  const storageMessage = ref('')
  const draftOwner = ref<string | null>(null)
  const pendingWrite = shallowRef<ReturnType<typeof useFeedbackWrite> | null>(null)

  watch(
    () => session.value.data?.user.id,
    (id) => {
      scope.startRequest()
      signInScope.startRequest()
      sessionScope.startRequest()
      draftOwner.value = id ?? null
      pendingWrite.value = id ? useFeedbackWrite(`post.${id}`) : null
      message.value = ''
      storageMessage.value = ''
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
      if (!id) {
        return
      }

      const stored = readStoredValue(`opine.feedback.draft.${id}`)
      if (stored.success) {
        Object.assign(form, parseSubmissionDraft(stored.value))
      } else {
        storageMessage.value = 'Your browser could not restore the saved draft.'
      }
    },
    { immediate: true },
  )

  watch(form, () => {
    if (!draftOwner.value) {
      return
    }

    if (!writeStoredValue(`opine.feedback.draft.${draftOwner.value}`, form)) {
      storageMessage.value =
        'Your draft cannot be saved in this browser. Keep this page open until you submit your feedback.'
    }
  })

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

    const result = submissionInput(form, pendingWrite.value?.pendingBody.value)
    if (!result.success) {
      fieldErrors.value = result.fieldErrors
      message.value = 'Please check the highlighted fields.'
      return
    }

    const owner = draftOwner.value
    const write = pendingWrite.value
    if (!owner || !write) {
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
      removeStoredValue(`opine.feedback.draft.${owner}`)

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
        message.value = 'Your session has expired. Sign in again to submit your saved draft.'
        try {
          await session.value.refetch()
        } catch {
          /* The expired-session message remains actionable. */
        }
      } else if (failure.status === 429) {
        message.value = 'You are posting too quickly. Please wait before trying again.'
      } else {
        message.value =
          'Unable to confirm submission. Your draft is saved; retrying the same submission is safe.'
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
    storageMessage,
    pendingWrite,
    signIn,
    retrySession,
    publish,
    clearTags,
  }
}
