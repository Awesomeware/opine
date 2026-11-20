import { getAccess } from '../../../auth/app/api/access'
import { getTags, createTag } from '../api/tags'
import { validateTagInput } from '../../shared/tag-input'
import type { FeedbackTag } from '../../shared/contracts'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { ref, onMounted } from 'vue'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'

/**
 * Mount per administrator account. A confirmed create clears its receipt even if refreshing the catalog fails.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackTagManagement(props: { owner: string }) {
  const tags = ref<FeedbackTag[]>([])
  const ready = ref(false)
  const allowed = ref(false)
  const loading = ref(false)
  const error = ref('')
  const scope = useRequestScope()

  const createError = ref('')
  const name = ref('')
  const busy = ref(false)
  const createWrite = useFeedbackWrite(`tags.create.${props.owner}`)

  const pending = validateTagInput(createWrite.pendingBody.value)
  if (pending.success) {
    name.value = pending.data.name
  }

  async function load() {
    const isCurrent = scope.startRequest()
    loading.value = true
    error.value = ''

    try {
      const access = await getAccess()
      if (!isCurrent()) {
        return
      }

      allowed.value = access.user?.id === props.owner && access.roles.includes('administrator')
      ready.value = true
      if (!allowed.value) {
        tags.value = []
        return
      }
      const data = await getTags()
      if (isCurrent()) {
        tags.value = data.tags
      }
    } catch {
      if (isCurrent()) {
        error.value = 'Unable to load tag management. Please retry.'
      }
    } finally {
      if (isCurrent()) {
        loading.value = false
      }
    }
  }

  async function create() {
    if (busy.value) {
      return
    }

    const body = { name: name.value.trim() }

    if (!body.name || body.name.length > 40) {
      createError.value = 'Enter a tag name between 1 and 40 characters.'
      return
    }

    busy.value = true
    createError.value = ''

    try {
      await createTag(body, createWrite.headers(body))
      if (!scope.isActive()) {
        return
      }

      createWrite.complete()
      name.value = ''
      await load()
    } catch (failure) {
      if (scope.isActive()) {
        createError.value =
          feedbackFailure(failure).status === 409
            ? 'A tag with that name already exists. Choose another name.'
            : feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  onMounted(load)

  return {
    tags,
    ready,
    allowed,
    loading,
    error,
    createError,
    name,
    busy,
    createWrite,
    load,
    create,
  }
}
