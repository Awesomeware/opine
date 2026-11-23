<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Button from '../../../../ui/app/components/Button.vue'
import { useFeedbackInbox } from '../composables/useFeedbackInbox'
import { statusLabels } from '../../../shared/status'

defineProps<{ owner: string }>()

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
  load,
  mark,
} = useFeedbackInbox()

const unreadFilter = ref<InstanceType<typeof Button> | null>(null)
const allFilter = ref<InstanceType<typeof Button> | null>(null)

async function markRead(id: string) {
  await mark(id)
  if (!markError.value) {
    // Marking reloads the list and removes the action that held keyboard focus.
    await nextTick()
    const filterButton = unread.value ? unreadFilter.value : allFilter.value
    filterButton?.focus()
  }
}

const items = ref<HTMLOListElement | null>(null)

async function loadMore() {
  const previousCount = notifications.value.length
  const focusedElement = document.activeElement
  await load(true)
  await nextTick()
  if (
    !error.value &&
    (document.activeElement === focusedElement || document.activeElement === document.body)
  ) {
    const firstNewItem = items.value?.children.item(previousCount)
    if (firstNewItem instanceof HTMLElement) {
      firstNewItem.focus()
    }
  }
}
</script>
<template>
  <p role="status">
    {{ unreadCount }} unread notifications. Only official responses trigger notifications.
  </p>
  <nav aria-label="Filter notifications">
    <Button ref="unreadFilter" type="button" :aria-pressed="unread" @click="unread = true">
      Unread
    </Button>
    <Button ref="allFilter" type="button" :aria-pressed="!unread" @click="unread = false">
      All notifications
    </Button>
  </nav>
  <p v-if="error" role="alert">
    {{ error }}
    <Button type="button" @click="load()">Retry notifications</Button>
  </p>
  <p v-if="markError" role="alert">{{ markError }}</p>
  <p v-if="loading" role="status">Loading notifications…</p>
  <p v-else-if="loaded && !notifications.length" role="status">
    {{ unread ? 'No unread notifications.' : 'No notifications yet.' }}
  </p>
  <ol ref="items" class="feedback-list">
    <li
      tabindex="-1"
      v-for="notification in notifications"
      :key="notification.id"
      class="panel feedback-card"
    >
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
      <Button
        v-else
        type="button"
        :busy="marking"
        :disabled="marking"
        @click="markRead(notification.id)"
      >
        Mark as read
      </Button>
    </li>
  </ol>
  <Button v-if="cursor" type="button" :busy="loading" @click="loadMore">
    Load more notifications
  </Button>
</template>
