import { computed, reactive, ref } from 'vue'
import type { FeedbackComment } from '../../shared/contracts'
import type { ContributionType } from '../../shared/contribution-types'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'
import { startDiscordSignIn } from '../../../auth/app/api/session'
import { commentEditInput, type CommentForm } from '../utils/editor-input'
import { getComment, editComment } from '../api/comment-edits'

/** Owns one mounted account/resource edit. Remount on identity changes; closing the form discards unsaved input. */
export function useCommentEditor(comment: FeedbackComment) {
  const endpoint = `/api/feedback/posts/${comment.postId}/comments/${comment.id}`
  const write = useFeedbackWrite()
  const scope = useRequestScope()
  const latestScope = useRequestScope()
  const route = useRoute()

  const form = reactive<CommentForm>({
    body: comment.body,
    type: comment.type ?? '',
    version: comment.version,
  })

  const baselineType = ref<ContributionType | ''>(comment.type ?? '')

  const saving = ref(false)
  const loadingLatest = ref(false)
  const busy = computed(() => saving.value || loadingLatest.value)
  const message = ref('')
  const latestError = ref('')
  const fieldErrors = ref<Record<string, string>>({})
  const expired = ref(false)
  const conflict = ref(false)
  const latest = ref<FeedbackComment | null>(null)

  async function signIn() {
    const error = await startDiscordSignIn(route.fullPath)
    if (scope.isActive() && error) {
      message.value = error
    }
  }

  async function save() {
    if (busy.value || conflict.value) {
      return false
    }

    message.value = ''
    fieldErrors.value = {}

    const parsed = commentEditInput(form, baselineType.value)
    if (!parsed.success) {
      fieldErrors.value = parsed.fieldErrors
      message.value = 'Please check the highlighted fields.'
      return false
    }

    saving.value = true

    try {
      // Keep the receipt key until confirmation: a lost reply may conceal a committed edit.
      await editComment(comment.postId, comment.id, parsed.data, write.headers(parsed.data))
      if (!scope.isActive()) {
        return false
      }
      write.complete()

      return true
    } catch (error) {
      if (!scope.isActive()) {
        return false
      }

      const failure = feedbackFailure(error)
      if (failure.status === 409) {
        conflict.value = true
        message.value =
          'This content changed while you were editing. Your text is preserved. Load the latest version to review it before saving again.'
      } else {
        fieldErrors.value = failure.fieldErrors

        message.value = Object.keys(fieldErrors.value).length
          ? 'Please check the highlighted fields.'
          : feedbackWriteError(error)
        expired.value = failure.status === 401
      }

      return false
    } finally {
      if (scope.isActive()) {
        saving.value = false
      }
    }
  }

  async function loadLatest() {
    const isCurrent = latestScope.startRequest()
    loadingLatest.value = true
    latestError.value = ''

    try {
      const current = (await getComment(comment.postId, comment.id)).comment
      if (isCurrent()) {
        latest.value = current
      }
    } catch {
      if (isCurrent()) {
        latestError.value = 'Unable to load the latest version. Please retry.'
      }
    } finally {
      if (isCurrent()) {
        loadingLatest.value = false
      }
    }
  }

  function acceptLatest() {
    if (!latest.value) {
      return
    }

    // Reviewing changes the concurrency baseline, never the author's unsaved content.
    baselineType.value = latest.value.type ?? ''
    form.version = latest.value.version
    conflict.value = false
    latest.value = null
    latestError.value = ''
    message.value =
      'Latest version reviewed. Your text is still in the form; review it and save when ready.'
  }

  return {
    endpoint,
    form,
    busy,
    saving,
    loadingLatest,
    message,
    latestError,
    fieldErrors,
    expired,
    conflict,
    latest,
    signIn,
    save,
    loadLatest,
    acceptLatest,
  }
}
