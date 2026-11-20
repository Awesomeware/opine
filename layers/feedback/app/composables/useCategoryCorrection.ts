import { getPost, getCategories } from '../api/posts'
import type { CategoryHistoryPage } from '../api/outcomes'
import { ref, onMounted } from 'vue'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'
import { validateCategoryCorrectionInput } from '../../shared/outcome-input'
import { correctCategory, getOutcome, getCategoryHistory } from '../api/outcomes'
import type { FeedbackCategory, FeedbackOutcome } from '../../shared/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'

/** Own one mounted post/account's correction, conflict review, and independent history read. */
export function useCategoryCorrection(
  props: { owner: string; postId: string; categoryId: string; version: number },
  saved: () => void,
) {
  const categories = ref<FeedbackCategory[]>([])
  const categoryId = ref(props.categoryId)
  // Refreshes must not change the version of an uncertain same-page retry.
  const version = ref(props.version)
  const busy = ref(false)
  const message = ref('')
  const conflict = ref(false)
  const latest = ref<FeedbackOutcome | null>(null)
  const latestCategory = ref('')
  const reviewing = ref(false)
  const reviewError = ref('')

  const categoriesLoading = ref(false)
  const categoriesError = ref('')
  const categoriesScope = useRequestScope()
  const changes = ref<CategoryHistoryPage['changes']>([])
  const cursor = ref<string | null>(null)
  const loadingHistory = ref(false)
  const historyScope = useRequestScope()
  const reviewScope = useRequestScope()
  const historyError = ref('')
  const write = useFeedbackWrite()
  const scope = useRequestScope()

  async function save() {
    if (busy.value || conflict.value) {
      return
    }

    const payload = { categoryId: categoryId.value, version: version.value }
    const parsed = validateCategoryCorrectionInput(payload)
    if (!parsed.success) {
      message.value = 'Choose a valid category before saving.'
      return
    }

    busy.value = true
    message.value = ''

    try {
      const result = await correctCategory(props.postId, parsed.data, write.headers(payload))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      version.value = result.version
      saved()
      message.value = 'Category corrected.'
      await loadHistory()
    } catch (failure) {
      if (!scope.isActive()) {
        return
      }
      if (feedbackFailure(failure).status === 409) {
        conflict.value = true
        message.value =
          'The workflow changed. Review the latest outcome before correcting the category.'
      } else {
        if (feedbackFailure(failure).status === 400) {
          write.complete()
          await loadCategories()
        }
        if (scope.isActive()) {
          message.value = feedbackWriteError(failure)
        }
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  async function review() {
    const current = reviewScope.startRequest()
    reviewing.value = true
    reviewError.value = ''

    try {
      const [value, post] = await Promise.all([getOutcome(props.postId), getPost(props.postId)])
      if (current()) {
        latest.value = value
        latestCategory.value = post.post.category.name
      }
    } catch {
      if (current()) {
        reviewError.value = 'Unable to load the latest outcome.'
      }
    } finally {
      if (current()) {
        reviewing.value = false
      }
    }
  }

  function accept() {
    if (!latest.value) {
      return
    }
    // Accept the new workflow baseline without replacing the selected category.
    version.value = latest.value.version
    conflict.value = false
    latest.value = null
    write.complete()
  }

  async function loadHistory(more = false) {
    if (more && loadingHistory.value) {
      return
    }
    const current = historyScope.startRequest()
    historyError.value = ''
    loadingHistory.value = true

    try {
      const result = await getCategoryHistory(
        props.postId,
        more ? (cursor.value ?? undefined) : undefined,
      )
      if (!current()) {
        return
      }
      changes.value = more ? [...changes.value, ...result.changes] : result.changes
      cursor.value = result.nextCursor
    } catch {
      if (current()) {
        historyError.value = 'Unable to load category history.'
      }
    } finally {
      if (current()) {
        loadingHistory.value = false
      }
    }
  }

  function name(id: string) {
    return categories.value.find((category) => category.id === id)?.name ?? id
  }

  async function loadCategories() {
    const current = categoriesScope.startRequest()
    categoriesLoading.value = true
    categoriesError.value = ''

    try {
      const result = await getCategories()
      if (current()) {
        categories.value = result.categories
      }
    } catch {
      if (current()) {
        categoriesError.value = 'Unable to load categories.'
      }
    } finally {
      if (current()) {
        categoriesLoading.value = false
      }
    }
  }

  onMounted(async () => {
    await Promise.all([loadCategories(), loadHistory()])
  })

  return {
    categories,
    categoriesLoading,
    categoriesError,
    loadCategories,
    reviewing,
    reviewError,
    categoryId,
    busy,
    message,
    conflict,
    latest,
    latestCategory,
    changes,
    cursor,
    loadingHistory,
    historyError,
    save,
    review,
    accept,
    loadHistory,
    name,
  }
}
