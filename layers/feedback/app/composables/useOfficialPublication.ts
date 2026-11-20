import { ref, reactive, watch, onMounted } from 'vue'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'
import { getOutcome, publishResponse } from '../api/outcomes'
import {
  isRecord,
  readStoredValue,
  writeStoredValue,
  removeStoredValue,
} from '../utils/stored-input'
import type { FeedbackOutcome } from '../../shared/contracts'
import { isPostStatus, type PostStatus } from '../../shared/status'
import { validateOfficialResponseInput } from '../../shared/outcome-input'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'

/** Keeps publication drafts and conflict review scoped to one mounted account/post. */
export function useOfficialPublication(
  props: { postId: string; owner: string | null },
  published: () => void,
) {
  const outcome = ref<FeedbackOutcome | null>(null)
  const error = ref('')
  const busy = ref(false)
  const message = ref('')
  const bodyError = ref('')
  const conflict = ref(false)
  const latest = ref<FeedbackOutcome | null>(null)
  const reviewing = ref(false)
  const reviewError = ref('')

  const form = reactive<{ body: string; status: PostStatus | ''; version: number }>({
    body: '',
    status: '',
    version: 0,
  })

  const draftKey = `opine.feedback.response.${props.owner}.${props.postId}`
  const write = useFeedbackWrite(`response.${props.owner}.${props.postId}`)
  const scope = useRequestScope()

  // Invalid persisted data cannot safely identify a mutation to replay.
  const restored = write.pendingBody.value
  if (restored !== null && !validateOfficialResponseInput(restored).success) {
    write.complete()
    message.value =
      'An invalid saved response request was discarded. Review your draft before publishing again.'
  }

  const outcomeScope = useRequestScope()
  const reviewScope = useRequestScope()
  let initialized = false

  // A stored draft retains the workflow version it was composed against.
  const saved = readStoredValue(draftKey)
  if (!saved.success) {
    message.value = 'Your response draft could not be restored.'
  } else if (
    props.owner &&
    isRecord(saved.value) &&
    typeof saved.value.body === 'string' &&
    typeof saved.value.version === 'number' &&
    Number.isSafeInteger(saved.value.version) &&
    saved.value.version >= 0 &&
    saved.value.version < 2147483647
  ) {
    form.body = saved.value.body
    form.status = isPostStatus(saved.value.status) ? saved.value.status : ''
    form.version = saved.value.version
    initialized = true
  }

  watch(
    form,
    () => {
      if (!props.owner) {
        return
      }
      if (!writeStoredValue(draftKey, form)) {
        message.value = 'Your draft cannot be saved in this browser. Keep this page open.'
      }
    },
    { flush: 'sync' },
  )

  async function load() {
    const current = outcomeScope.startRequest()

    try {
      const result = await getOutcome(props.postId)
      if (!current()) {
        return
      }
      outcome.value = result
      error.value = ''
      if (!initialized) {
        form.version = result.version
        initialized = true
      }
    } catch {
      if (current()) {
        error.value = 'Unable to load the official response and follow state.'
      }
    }
  }

  async function publish(retry = false) {
    if (busy.value || conflict.value || !props.owner) {
      return
    }

    const payload = retry
      ? write.pendingBody.value
      : {
          body: form.body.trim(),
          ...(form.status ? { status: form.status } : {}),
          version: form.version,
        }
    bodyError.value = ''
    const parsed = validateOfficialResponseInput(payload)
    if (!parsed.success) {
      bodyError.value = parsed.fieldErrors.body ?? ''
      message.value = 'Please check the highlighted fields.'
      return
    }

    busy.value = true
    message.value = ''

    try {
      // Retries preserve the original request body as well as its receipt key.
      const requestBody = parsed.data
      if (retry && isRecord(payload) && typeof payload.body === 'string') {
        requestBody.body = payload.body
      }
      const result = await publishResponse(props.postId, requestBody, write.headers(payload))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      form.body = ''
      form.status = ''
      initialized = false
      await load()
      if (!scope.isActive()) {
        return
      }
      removeStoredValue(draftKey)
      published()
      await navigateTo({
        path: `/feedback/${props.postId}`,
        query: { response: result.id },
        hash: `#response-${result.id}`,
      })
    } catch (failure) {
      if (!scope.isActive()) {
        return
      }
      if (feedbackFailure(failure).status === 409) {
        conflict.value = true
        message.value =
          'The team workflow changed. Your draft is preserved. Review the latest outcome before publishing.'
      } else {
        if (feedbackFailure(failure).status === 400) {
          write.complete()
        }
        message.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  async function loadLatest() {
    const current = reviewScope.startRequest()
    reviewing.value = true
    reviewError.value = ''

    try {
      const result = await getOutcome(props.postId)
      if (current()) {
        latest.value = result
      }
    } catch {
      if (current()) {
        reviewError.value = 'Unable to load the latest outcome. Please retry.'
      }
    } finally {
      if (current()) {
        reviewing.value = false
      }
    }
  }

  function acceptLatest() {
    if (!latest.value) {
      return
    }
    outcome.value = latest.value
    // Reviewing a conflict changes the baseline, never the author's draft.
    form.version = latest.value.version
    latest.value = null
    conflict.value = false
    write.complete()
    message.value = 'Latest outcome reviewed. Review your preserved draft before publishing.'
  }

  onMounted(load)

  return {
    outcome,
    reviewing,
    reviewError,
    error,
    busy,
    message,
    bodyError,
    conflict,
    latest,
    form,
    write,
    load,
    publish,
    loadLatest,
    acceptLatest,
  }
}
