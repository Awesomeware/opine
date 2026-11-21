import { getNotifications, markNotificationRead } from '../api/notifications'
import type { FeedbackNotification } from '../../../shared/subscriptions/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../../composables/useFeedbackWrite'
import { ref, watch, onMounted } from 'vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure } from '../../api/errors'

/**
 * Keep pagination and mark-read errors independent. Mount per account to isolate private results.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackInbox() {
  const notifications = ref<FeedbackNotification[]>([])
  const unread = ref(true)
  const unreadCount = ref(0)
  const cursor = ref<string | null>(null)
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const scope = useRequestScope()

  const marking = ref(false)
  const markError = ref('')
  const write = useFeedbackWrite()

  async function load(more = false) {
    if (more && loading.value) {
      return
    }

    const isCurrent = scope.startRequest()
    loading.value = true
    error.value = ''

    if (!more) {
      notifications.value = []
      cursor.value = null
      loaded.value = false
    }

    try {
      const result = await getNotifications(
        unread.value,
        more ? (cursor.value ?? undefined) : undefined,
      )
      if (!isCurrent()) {
        return
      }

      notifications.value = more
        ? [...notifications.value, ...result.notifications]
        : result.notifications
      cursor.value = result.nextCursor
      unreadCount.value = result.unreadCount
      loaded.value = true
    } catch (failure) {
      if (isCurrent()) {
        const { status } = feedbackFailure(failure)

        if ([401, 403].includes(status ?? 0)) {
          notifications.value = []
          cursor.value = null
          unreadCount.value = 0
        }
        error.value =
          status === 401
            ? 'Your session expired. Sign in again to see notifications.'
            : 'Unable to load notifications. Please retry.'
      }
    } finally {
      if (isCurrent()) {
        loading.value = false
      }
    }
  }

  async function mark(id: string) {
    if (marking.value) {
      return
    }
    marking.value = true
    markError.value = ''

    const payload = { id, read: true }

    try {
      await markNotificationRead(id, write.headers(payload))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      await load()
    } catch (failure) {
      if (scope.isActive()) {
        markError.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        marking.value = false
      }
    }
  }

  watch(unread, () => load())

  onMounted(() => load())

  return {
    notifications,
    unread,
    unreadCount,
    cursor,
    loading,
    loaded,
    marking,
    error,
    markError,
    load,
    mark,
  }
}
