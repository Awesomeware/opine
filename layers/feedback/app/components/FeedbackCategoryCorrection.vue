<script setup lang="ts">
import type { FeedbackCategory, FeedbackOutcome, FeedbackPost } from '../../shared/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ owner: string; postId: string; categoryId: string; version: number }>()
const emit = defineEmits<{ saved: [] }>()
const categories = ref<FeedbackCategory[]>([])
const categoryId = ref(props.categoryId)
const version = ref(props.version)
const busy = ref(false)
const message = ref('')
const conflict = ref(false)
const latest = ref<FeedbackOutcome | null>(null)
const latestCategory = ref('')
const changes = ref<
  {
    id: string
    previousCategoryId: string
    categoryId: string
    actor: { name: string }
    createdAt: string
  }[]
>([])
const cursor = ref<string | null>(null)
const loadingHistory = ref(false)
let historyRequest = 0
const write = useFeedbackWrite(`category.${props.owner}.${props.postId}`)
const endpoint = `/api/feedback/posts/${props.postId}`
let active = true
onBeforeUnmount(() => {
  active = false
})
watch(
  () => props.version,
  (value) => {
    if (!conflict.value && !write.pendingBody.value) version.value = value
  },
)
async function save(retry = false) {
  if (busy.value || conflict.value) return
  const payload = retry
    ? (write.pendingBody.value as { categoryId: string; version: number })
    : { categoryId: categoryId.value, version: version.value }
  if (!payload) return
  busy.value = true
  message.value = ''
  try {
    await $fetch(`${endpoint}/category`, {
      method: 'PATCH',
      body: payload,
      headers: write.headers(payload),
      retry: 0,
    })
    if (!active) return
    write.complete()
    emit('saved')
    await loadHistory()
    message.value = 'Category corrected.'
  } catch (failure) {
    if (!active) return
    if ((failure as { statusCode?: number }).statusCode === 409) {
      conflict.value = true
      message.value =
        'The workflow changed. Review the latest outcome before correcting the category.'
    } else {
      if ((failure as { statusCode?: number }).statusCode === 400) {
        write.complete()
        try {
          const result = await $fetch<{ categories: FeedbackCategory[] }>(
            '/api/feedback/categories',
          )
          if (active) categories.value = result.categories
        } catch {
          /* Keep the correction available for retry. */
        }
      }
      if (active) message.value = feedbackWriteError(failure)
    }
  } finally {
    busy.value = false
  }
}
async function review() {
  try {
    const [value, post] = await Promise.all([
      $fetch<FeedbackOutcome>(`${endpoint}/outcome`),
      $fetch<{ post: FeedbackPost }>(endpoint),
    ])
    if (active) {
      latest.value = value
      latestCategory.value = post.post.category.name
    }
  } catch {
    if (active) message.value = 'Unable to load the latest outcome.'
  }
}
function accept() {
  if (!latest.value) return
  version.value = latest.value.version
  conflict.value = false
  latest.value = null
  write.complete()
}
async function loadHistory(more = false) {
  if (more && loadingHistory.value) return
  const request = ++historyRequest
  loadingHistory.value = true
  try {
    const result = await $fetch<{ changes: typeof changes.value; nextCursor: string | null }>(
      `${endpoint}/category-history`,
      { query: more && cursor.value ? { cursor: cursor.value } : {} },
    )
    if (!active || request !== historyRequest) return
    changes.value = more ? [...changes.value, ...result.changes] : result.changes
    cursor.value = result.nextCursor
  } catch {
    if (active && request === historyRequest) message.value = 'Unable to load category history.'
  } finally {
    if (active && request === historyRequest) loadingHistory.value = false
  }
}
function name(id: string) {
  return categories.value.find((category) => category.id === id)?.name ?? id
}
onMounted(async () => {
  try {
    const result = await $fetch<{ categories: FeedbackCategory[] }>('/api/feedback/categories')
    if (active) categories.value = result.categories
  } catch {
    if (active) message.value = 'Unable to load categories.'
  }
  await loadHistory()
})
</script>
<template>
  <details class="panel category-correction">
    <summary>Correct category</summary>
    <form class="feedback-form" @submit.prevent="save()">
      <div class="field">
        <label for="correct-category">Corrected category</label
        ><select
          id="correct-category"
          v-model="categoryId"
          :disabled="busy || !!write.pendingBody.value"
        >
          <option
            v-for="category in categories"
            :key="category.id"
            :value="category.id"
            :disabled="!category.isActive"
          >
            {{ category.name }}{{ category.isActive ? '' : ' (unavailable)' }}
          </option>
        </select>
      </div>
      <p v-if="message" role="alert">{{ message }}</p>
      <p v-if="write.warning.value">{{ write.warning.value }}</p>
      <div v-if="conflict">
        <UiButton type="button" @click="review">Review category conflict</UiButton>
        <div v-if="latest">
          <p>Current category: {{ latestCategory }}</p>
          <FeedbackOfficialResponse
            v-if="latest.latestResponse"
            :response="latest.latestResponse"
            featured
          /><UiButton type="button" @click="accept">I’ve reviewed the category conflict</UiButton>
        </div>
      </div>
      <UiButton
        v-if="write.pendingBody.value && !conflict"
        type="button"
        :busy="busy"
        :disabled="busy"
        @click="save(true)"
      >
        Retry pending category correction</UiButton
      ><UiButton
        type="submit"
        :busy="busy"
        :disabled="busy || conflict || !!write.pendingBody.value"
      >
        Save category correction
      </UiButton>
    </form>
    <h3>Category history</h3>
    <p v-if="!changes.length">No category corrections.</p>
    <ol>
      <li v-for="change in changes" :key="change.id">
        {{ name(change.previousCategoryId) }} → {{ name(change.categoryId) }} ·
        {{ change.actor.name }} · {{ new Date(change.createdAt).toLocaleString() }}
      </li>
    </ol>
    <UiButton
      v-if="cursor"
      type="button"
      :busy="loadingHistory"
      :disabled="loadingHistory"
      @click="loadHistory(true)"
    >
      Load more category history
    </UiButton>
  </details>
</template>
<style scoped>
.category-correction {
  margin: 1rem 0;
  padding: 1rem;
}
</style>
