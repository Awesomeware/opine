import { getReviewQueue, type ReviewFilters } from '../api/review'
import { getTags } from '../../posts/api/tags'
import type { FeedbackTag, FeedbackPostSummary } from '../../../shared/posts/contracts'
import { isPostStatus } from '../../../shared/status'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure } from '../../api/errors'

/**
 * Queue and tag reads have separate lifetimes: an unavailable catalog must remain visible and retryable.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackReviewQueue() {
  const route = useRoute()
  const applied = computed<ReviewFilters>(() => ({
    tagId: typeof route.query.tagId === 'string' ? route.query.tagId : '',
    status:
      isPostStatus(route.query.status) || route.query.status === 'all' ? route.query.status : 'new',
    followUp: route.query.followUp === 'true',
  }))
  const filters = reactive({ ...applied.value })
  const posts = ref<FeedbackPostSummary[]>([])
  const cursor = ref<string | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const scope = useRequestScope()

  const tags = ref<FeedbackTag[]>([])
  const tagsError = ref('')
  const tagsLoading = ref(false)
  const tagsScope = useRequestScope()

  async function load(more = false) {
    if (more && loading.value) {
      return
    }

    const isCurrent = scope.startRequest()
    loading.value = true
    error.value = ''

    if (!more) {
      posts.value = []
      cursor.value = null
      loaded.value = false
    }

    try {
      const result = await getReviewQueue(
        applied.value,
        more ? (cursor.value ?? undefined) : undefined,
      )
      if (!isCurrent()) {
        return
      }

      posts.value = more ? [...posts.value, ...result.posts] : result.posts
      cursor.value = result.nextCursor
      loaded.value = true
    } catch (failure) {
      if (isCurrent()) {
        const { status } = feedbackFailure(failure)

        if ([401, 403].includes(status ?? 0)) {
          posts.value = []
          cursor.value = null
        }
        error.value =
          status === 403
            ? 'Only community managers can use the review queue.'
            : status === 401
              ? 'Your session expired. Sign in again to review feedback.'
              : 'Unable to load the review queue. Please retry.'
      }
    } finally {
      if (isCurrent()) {
        loading.value = false
      }
    }
  }

  async function apply() {
    await navigateTo({
      query: {
        tagId: filters.tagId || undefined,
        status: filters.status,
        followUp: filters.followUp ? 'true' : undefined,
      },
    })
  }

  watch(applied, (value) => {
    Object.assign(filters, value)
    void load()
  })

  async function loadTags() {
    const isCurrent = tagsScope.startRequest()
    tagsLoading.value = true
    tagsError.value = ''

    try {
      const result = await getTags()
      if (isCurrent()) {
        tags.value = result.tags
      }
    } catch {
      if (isCurrent()) {
        tagsError.value = 'Unable to load tags.'
      }
    } finally {
      if (isCurrent()) {
        tagsLoading.value = false
      }
    }
  }

  onMounted(() => {
    void load()
    void loadTags()
  })

  return {
    filters,
    posts,
    tags,
    tagsError,
    tagsLoading,
    loadTags,
    cursor,
    loading,
    loaded,
    error,
    load,
    apply,
  }
}
