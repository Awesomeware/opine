import { getReviewQueue, type ReviewFilters } from '../api/review'
import { getCategories } from '../../posts/api/posts'
import type { FeedbackCategory, FeedbackPostSummary } from '../../../shared/posts/contracts'
import { isPostStatus } from '../../../shared/status'
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure } from '../../api/errors'

/**
 * Queue and category reads have separate lifetimes: an unavailable catalog must remain visible and retryable.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackReviewQueue() {
  const route = useRoute()
  const applied = computed<ReviewFilters>(() => ({
    category: typeof route.query.category === 'string' ? route.query.category : '',
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

  const categories = ref<FeedbackCategory[]>([])
  const categoryError = ref('')
  const categoriesLoading = ref(false)
  const categoryScope = useRequestScope()

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
        category: filters.category || undefined,
        status: filters.status,
        followUp: filters.followUp ? 'true' : undefined,
      },
    })
  }

  watch(applied, (value) => {
    Object.assign(filters, value)
    void load()
  })

  async function loadCategories() {
    const isCurrent = categoryScope.startRequest()
    categoriesLoading.value = true
    categoryError.value = ''

    try {
      const result = await getCategories()
      if (isCurrent()) {
        categories.value = result.categories
      }
    } catch {
      if (isCurrent()) {
        categoryError.value = 'Unable to load categories.'
      }
    } finally {
      if (isCurrent()) {
        categoriesLoading.value = false
      }
    }
  }

  onMounted(() => {
    void load()
    void loadCategories()
  })

  return {
    filters,
    posts,
    categories,
    categoryError,
    categoriesLoading,
    loadCategories,
    cursor,
    loading,
    loaded,
    error,
    load,
    apply,
  }
}
