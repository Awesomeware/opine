<script setup lang="ts">
import { useFeedbackInbox } from '../composables/useFeedbackInbox'
import { statusLabels } from '../../shared/status'

const props = defineProps<{ owner: string }>()

const {
  notifications,
  unread,
  unreadCount,
  cursor,
  loading,
  loaded,
  marking,
  error,
  markError,
  write,
  load,
  mark,
  retryMark,
} = useFeedbackInbox(props)
</script>
<template>
  <p>{{ unreadCount }} unread notifications. Only official responses trigger notifications.</p>
  <nav aria-label="Filter notifications">
    <UiButton type="button" :aria-pressed="unread" @click="unread = true">Unread</UiButton>
    <UiButton type="button" :aria-pressed="!unread" @click="unread = false">
      All notifications
    </UiButton>
  </nav>
  <p v-if="error" role="alert">
    {{ error }}
    <UiButton type="button" @click="load()">Retry notifications</UiButton>
  </p>
  <p v-if="markError" role="alert">{{ markError }}</p>
  <p v-if="write.warning.value">{{ write.warning.value }}</p>
  <UiButton
    v-if="write.pendingBody.value"
    type="button"
    :busy="marking"
    :disabled="marking"
    @click="retryMark"
  >
    Retry marking notification read
  </UiButton>
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
        >
          {{ notification.postTitle }}
        </NuxtLink>
      </h2>
      <p>
        New official response
        <span v-if="notification.status">· {{ statusLabels[notification.status] }}</span>
      </p>
      <time :datetime="notification.createdAt">
        {{ new Date(notification.createdAt).toLocaleString() }}
      </time>
      <p v-if="notification.readAt">Read</p>
      <UiButton
        v-else
        type="button"
        :busy="marking"
        :disabled="marking || !!write.pendingBody.value"
        @click="mark(notification.id)"
      >
        Mark as read
      </UiButton>
    </li>
  </ol>
  <UiButton v-if="cursor" type="button" :busy="loading" @click="load(true)">
    Load more notifications
  </UiButton>
</template>
