import { computed, reactive, ref } from 'vue'
import type { FeedbackPost } from '../../../shared/posts/contracts'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure, feedbackWriteError } from '../../api/errors'
import { startDiscordSignIn } from '../../../../auth/app/api/session'
import { postEditInput, type PostForm } from '../utils/post-editor-input'
import { getPost, editPost } from '../api/posts'
import { getTags } from '../api/tags'

/** Owns one mounted account/resource edit. Remount on identity changes; closing the form discards unsaved input. */
export function usePostEditor(owner: string, post: FeedbackPost) {
  const endpoint = `/api/feedback/posts/${post.id}`
  const scope = useRequestScope()
  const latestScope = useRequestScope()
  const route = useRoute()

  const form = reactive<PostForm>({
    title: post.title,
    description: post.description,
    desiredImprovement: post.desiredImprovement ?? '',
    tagIds: post.tags.map((tag) => tag.id),
    version: post.version,
  })

  const baselineTags = ref(post.tags)
  const {
    data: tagData,
    pending: tagsPending,
    error: tagsError,
    refresh: refreshTags,
  } = useAsyncData(`editor-tags.${owner}.${post.id}`, getTags)
  const availableTags = computed(() => {
    const tags = [...(tagData.value?.tags ?? [])]
    for (const tag of baselineTags.value) {
      if (!tags.some((value) => value.id === tag.id)) {
        tags.push(tag)
      }
    }

    return tags
  })

  const saving = ref(false)
  const loadingLatest = ref(false)
  const busy = computed(() => saving.value || loadingLatest.value)
  const message = ref('')
  const latestError = ref('')
  const fieldErrors = ref<Record<string, string>>({})
  const expired = ref(false)
  const conflict = ref(false)
  const latest = ref<FeedbackPost | null>(null)

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

    const parsed = postEditInput(
      form,
      baselineTags.value.map((tag) => tag.id),
    )
    if (!parsed.success) {
      fieldErrors.value = parsed.fieldErrors
      message.value = 'Please check the highlighted fields.'
      return false
    }

    saving.value = true

    try {
      await editPost(post.id, parsed.data)
      if (!scope.isActive()) {
        return false
      }

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

        if (failure.status === 400) {
          await refreshTags()
          if (!scope.isActive()) {
            return false
          }
          if (!Object.keys(fieldErrors.value).length) {
            fieldErrors.value.tagIds =
              'Check your selected tags. Unavailable tags can only be kept on posts that already have them, or removed.'
          }
        }

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
      const current = (await getPost(post.id)).post
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
    baselineTags.value = latest.value.tags
    form.version = latest.value.version
    conflict.value = false
    latest.value = null
    latestError.value = ''
    message.value =
      'Latest version reviewed. Your text is still in the form; review it and save when ready.'
  }

  function clearTags() {
    form.tagIds = []
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
    baselineTags,
    availableTags,
    tagsPending,
    tagsError,
    refreshTags,
    clearTags,
  }
}
