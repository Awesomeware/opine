<script setup lang="ts">
import type { FeedbackNotification, FeedbackNotificationsPage } from '../../shared/contracts'
import { statusLabels } from '../../shared/status'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ owner: string }>()
const notifications = ref<FeedbackNotification[]>([])
const unread = ref(true)
const unreadCount = ref(0)
const cursor = ref<string | null>(null)
const loading = ref(false)
const loaded = ref(false)
const marking = ref(false)
const error = ref('')
const write = useFeedbackWrite(`notification.${props.owner}`)
let active = true
let request = 0
onBeforeUnmount(() => {
  active = false
  request++
})
async function load(more = false) {
  if (more && loading.value) return
  const current = ++request
  loading.value = true
  error.value = ''
  if (!more) {
    notifications.value = []
    cursor.value = null
    loaded.value = false
  }
  try {
    const result = await $fetch<FeedbackNotificationsPage>('/api/feedback/notifications', {
      query: {
        unread: unread.value ? 'true' : undefined,
        ...(more && cursor.value ? { cursor: cursor.value } : {}),
      },
    })
    if (!active || current !== request) return
    notifications.value = more
      ? [...notifications.value, ...result.notifications]
      : result.notifications
    cursor.value = result.nextCursor
    unreadCount.value = result.unreadCount
    loaded.value = true
  } catch (failure) {
    if (active && current === request) {
      if ([401, 403].includes((failure as { statusCode?: number }).statusCode ?? 0)) {
        notifications.value = []
        cursor.value = null
        unreadCount.value = 0
      }
      error.value =
        (failure as { statusCode?: number }).statusCode === 401
          ? 'Your session expired. Sign in again to see notifications.'
          : 'Unable to load notifications. Please retry.'
    }
  } finally {
    if (active && current === request) loading.value = false
  }
}
async function mark(id: string) {
  if (marking.value) return
  marking.value = true
  const payload = { id, read: true }
  try {
    await $fetch(`/api/feedback/notifications/${id}`, {
      method: 'PATCH',
      body: { read: true },
      headers: write.headers(payload),
      retry: 0,
    })
    if (!active) return
    write.complete()
    await load()
  } catch (failure) {
    if (active) error.value = feedbackWriteError(failure)
  } finally {
    marking.value = false
  }
}
function retryMark() {
  const payload = write.pendingBody.value as { id: string } | null
  if (payload) void mark(payload.id)
}
watch(unread, () => load())
onMounted(() => load())
</script>
<template>
  <p>{{ unreadCount }} unread notifications. Only official team responses trigger notifications.</p>
  <nav aria-label="Filter notifications">
    <button type="button" :aria-pressed="unread" @click="unread = true">Unread</button> <button
      type="button"
      :aria-pressed="!unread"
      @click="unread = false"
    >
      All notifications
    </button>
  </nav>
  <p v-if="error" role="alert">
    {{ error }} <button type="button" @click="load()">Retry notifications</button>
  </p>
  <p v-if="write.warning.value">{{ write.warning.value }}</p>
  <button v-if="write.pendingBody.value" type="button" :disabled="marking" @click="retryMark">
    Retry marking notification read
  </button>
  <p v-if="loading" role="status">Loading notifications…</p>
  <p v-else-if="loaded && !notifications.length">
    {{ unread ? 'No unread notifications.' : 'No notifications yet.' }}
  </p>
  <ol class="feedback-list">
    <li v-for="notification in notifications" :key="notification.id" class="panel feedback-card">
      <h2>
        <NuxtLink
          :to="{
            path: `/feedback/${notification.postId}`,
            query: { response: notification.responseId },
            hash: `#response-${notification.responseId}`,
          }"
          >{{ notification.postTitle }}</NuxtLink
        >
      </h2>
      <p>
        New official response<span v-if="notification.status">
          · {{ statusLabels[notification.status] }}</span
        >
      </p>
      <time :datetime="notification.createdAt">{{
        new Date(notification.createdAt).toLocaleString()
      }}</time>
      <p v-if="notification.readAt">Read</p>
      <button
        v-else
        type="button"
        :disabled="marking || !!write.pendingBody.value"
        @click="mark(notification.id)"
      >
        Mark as read
      </button>
    </li>
  </ol>
  <button v-if="cursor" type="button" :disabled="loading" @click="load(true)">
    Load more notifications
  </button>
</template>
