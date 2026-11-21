import { getComment } from '../api/comment-edits'
import { ref, computed, watch, onMounted } from 'vue'
import { getDiscussion, getLinkedResponse } from '../api/discussion'
import { useRequestScope } from '../../composables/useRequestScope'
import type { FeedbackComment, FeedbackDiscussionPage } from '../../../shared/discussion/contracts'
import type { OfficialResponse } from '../../../shared/review/contracts'
import {
  isContributionType,
  type ContributionType,
} from '../../../shared/discussion/contribution-types'

/** Separate request streams prevent filter changes from invalidating permalink resolution. */
export function useFeedbackDiscussion(postId: string) {
  const route = useRoute()
  const commentsScope = useRequestScope()
  const targetScope = useRequestScope()
  const targetError = ref('')
  type Entry = FeedbackDiscussionPage['entries'][number]
  const entries = ref<Entry[]>([])
  const comments = computed(() =>
    entries.value.flatMap((entry) => (entry.kind === 'comment' ? [entry.comment] : [])),
  )
  const targetResponse = ref<OfficialResponse | null>(null)
  const target = ref<FeedbackComment | null>(null)
  const nextCursor = ref<string | null>(null)
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref('')
  const filter = computed(() =>
    isContributionType(route.query.contribution) || route.query.contribution === 'team'
      ? route.query.contribution
      : undefined,
  )

  async function loadComments(more = false) {
    if (more && loading.value) {
      return
    }
    const current = commentsScope.startRequest()
    const selected = filter.value
    loading.value = true
    error.value = ''

    try {
      const page = await getDiscussion(
        postId,
        selected,
        more ? (nextCursor.value ?? undefined) : undefined,
      )
      if (!current()) {
        return
      }
      entries.value = more ? [...entries.value, ...page.entries] : page.entries
      nextCursor.value = page.nextCursor
      loaded.value = true
    } catch {
      if (current()) {
        error.value = 'Unable to load comments. Please retry.'
      }
    } finally {
      if (current()) {
        loading.value = false
      }
    }
  }

  async function loadTarget() {
    const current = targetScope.startRequest()
    targetError.value = ''
    target.value = null
    targetResponse.value = null
    const responseId = route.query.response
    if (typeof responseId === 'string') {
      try {
        const result = await getLinkedResponse(postId, responseId)
        if (!current()) {
          return
        }
        targetResponse.value = result.response
      } catch {
        if (current()) {
          targetError.value = 'The linked official response could not be loaded.'
        }
      }
      return
    }
    const id = route.query.comment
    if (typeof id !== 'string') {
      return
    }

    try {
      const response = await getComment(postId, id)
      if (!current()) {
        return
      }
      target.value = response.comment
    } catch {
      if (current()) {
        targetError.value = 'The linked comment could not be loaded.'
      }
    }
  }

  async function retryComments() {
    await Promise.all([loadComments(), loadTarget()])
  }
  const visibleEntries = computed(() => {
    const result = [...entries.value]
    if (target.value && !comments.value.some((comment) => comment.id === target.value?.id)) {
      result.unshift({ kind: 'comment', comment: target.value })
    }
    if (
      targetResponse.value &&
      !result.some(
        (entry) => entry.kind === 'response' && entry.response.id === targetResponse.value?.id,
      )
    ) {
      result.unshift({ kind: 'response', response: targetResponse.value })
    }
    return result
  })

  async function selectFilter(value?: ContributionType | 'team') {
    await navigateTo({ query: { ...route.query, contribution: value }, hash: route.hash })
  }

  watch(filter, () => {
    entries.value = []
    nextCursor.value = null
    loaded.value = false
    void loadComments()
  })

  // Only permalink changes resolve the target; filters keep the loaded target.
  watch([() => route.query.comment, () => route.query.response], loadTarget, { immediate: true })

  onMounted(() => loadComments())

  return {
    entries,
    comments,
    targetResponse,
    target,
    nextCursor,
    loaded,
    loading,
    error,
    targetError,
    filter,
    visibleEntries,
    loadComments,
    loadTarget,
    retryComments,
    selectFilter,
  }
}
