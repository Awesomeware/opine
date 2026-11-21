import { getTags, updateTag } from '../api/tags'
import type { FeedbackTag } from '../../../shared/posts/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../../composables/useFeedbackWrite'
import { ref, reactive } from 'vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure } from '../../api/errors'

/**
 * Mount per account/tag. Retain entered fields while reviewing a newer version.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackTagEditor(
  props: { tag: FeedbackTag; owner: string },
  onSaved: () => void,
) {
  const write = useFeedbackWrite()

  const form = reactive({
    name: props.tag.name,
    isActive: props.tag.isActive,
    version: props.tag.version,
  })

  const busy = ref(false)
  const message = ref('')
  const scope = useRequestScope()

  const refreshError = ref('')
  const refreshing = ref(false)
  const refreshScope = useRequestScope()

  const conflict = ref(false)
  const latest = ref<FeedbackTag | null>(null)

  async function save() {
    if (busy.value || conflict.value || refreshing.value || refreshError.value) {
      return
    }

    const body = { ...form, name: form.name.trim() }

    if (!body.name || body.name.length > 40) {
      message.value = 'Enter a tag name between 1 and 40 characters.'
      return
    }

    busy.value = true
    message.value = ''

    try {
      const saved = await updateTag(props.tag.id, body, write.headers(body))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      Object.assign(form, { ...body, version: saved.version })
      message.value = 'Tag saved.'

      onSaved()
    } catch (failure) {
      if (!scope.isActive()) {
        return
      }

      if (feedbackFailure(failure).status === 409) {
        conflict.value = true
        message.value =
          'This tag changed or its name is already in use. Load the latest version and review it before saving again.'
      } else {
        message.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  async function loadLatest() {
    latest.value = null
    const isCurrent = refreshScope.startRequest()
    refreshing.value = true
    refreshError.value = ''

    try {
      const data = await getTags()
      if (isCurrent()) {
        latest.value = data.tags.find((tag) => tag.id === props.tag.id) ?? null
        if (!latest.value) {
          refreshError.value = 'Unable to load the latest tag. Please retry.'
        }
      }
    } catch {
      if (isCurrent()) {
        refreshError.value = 'Unable to load the latest tag. Please retry.'
      }
    } finally {
      if (isCurrent()) {
        refreshing.value = false
      }
    }
  }

  function reviewed() {
    if (!latest.value || refreshing.value) {
      return
    }
    // Reviewing advances the concurrency baseline without replacing the author’s input.
    form.version = latest.value.version
    latest.value = null
    conflict.value = false
    message.value = 'Latest version reviewed. Your changes remain in the form.'
  }

  return {
    form,
    busy,
    message,
    refreshError,
    refreshing,
    conflict,
    latest,
    save,
    loadLatest,
    reviewed,
  }
}
