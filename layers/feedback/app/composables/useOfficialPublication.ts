import { ref, reactive, onMounted } from 'vue'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'
import { getOutcome, publishResponse } from '../api/outcomes'
import type { FeedbackOutcome } from '../../shared/contracts'
import { type PostStatus } from '../../shared/status'
import { validateOfficialResponseInput } from '../../shared/outcome-input'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'

/** Keeps publication fields and conflict review scoped to one mounted account/post. */
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

  const write = useFeedbackWrite()
  const scope = useRequestScope()

  const outcomeScope = useRequestScope()
  const reviewScope = useRequestScope()
  let initialized = false

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

  async function publish() {
    if (busy.value || conflict.value || !props.owner) {
      return
    }

    const payload = {
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
      const result = await publishResponse(props.postId, parsed.data, write.headers(parsed.data))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      form.body = ''
      form.status = ''
      form.version = result.version
      await load()
      if (!scope.isActive()) {
        return
      }
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
          'The team workflow changed. Your text remains in the form. Review the latest outcome before publishing.'
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
    // Reviewing a conflict changes the baseline, never the author's text.
    form.version = latest.value.version
    latest.value = null
    conflict.value = false
    write.complete()
    message.value = 'Latest outcome reviewed. Review your text before publishing.'
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
    load,
    publish,
    loadLatest,
    acceptLatest,
  }
}
