<script setup lang="ts">
import type { FeedbackCategory, FeedbackPage, FeedbackPostSummary } from '../../shared/contracts'
import { postStatuses, statusLabels, isPostStatus } from '../../shared/status'
const route = useRoute()
const applied = computed(() => ({
  category: typeof route.query.category === 'string' ? route.query.category : '',
  status:
    isPostStatus(route.query.status) || route.query.status === 'all' ? route.query.status : 'new',
  followUp: route.query.followUp === 'true',
}))
const filters = reactive({ ...applied.value })
const posts = ref<FeedbackPostSummary[]>([])
const categories = ref<FeedbackCategory[]>([])
const cursor = ref<string | null>(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
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
    posts.value = []
    cursor.value = null
    loaded.value = false
  }
  try {
    const result = await $fetch<FeedbackPage>('/api/feedback/review', {
      query: {
        category: applied.value.category || undefined,
        status: applied.value.status,
        followUp: applied.value.followUp ? 'true' : undefined,
        ...(more && cursor.value ? { cursor: cursor.value } : {}),
      },
    })
    if (!active || current !== request) return
    posts.value = more ? [...posts.value, ...result.posts] : result.posts
    cursor.value = result.nextCursor
    loaded.value = true
  } catch (failure) {
    if (active && current === request) {
      if ([401, 403].includes((failure as { statusCode?: number }).statusCode ?? 0)) {
        posts.value = []
        cursor.value = null
      }
      error.value =
        (failure as { statusCode?: number }).statusCode === 403
          ? 'Only community managers can use the review queue.'
          : (failure as { statusCode?: number }).statusCode === 401
            ? 'Your session expired. Sign in again to review feedback.'
            : 'Unable to load the review queue. Please retry.'
    }
  } finally {
    if (active && current === request) loading.value = false
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
onMounted(async () => {
  void load()
  try {
    const result = await $fetch<{ categories: FeedbackCategory[] }>('/api/feedback/categories')
    if (active) categories.value = result.categories
  } catch {
    /* Queue remains usable. */
  }
})
</script>
<template>
  <p>Oldest feedback first. The initial queue shows New posts awaiting review.</p>
  <form class="panel filters" @submit.prevent="apply">
    <div class="field">
      <label for="queue-category">Category</label
      ><select id="queue-category" v-model="filters.category">
        <option value="">All categories</option>
        <option v-for="category in categories" :key="category.id" :value="category.slug">
          {{ category.name }}
        </option>
      </select>
    </div>
    <div class="field">
      <label for="queue-status">Status</label
      ><select id="queue-status" v-model="filters.status">
        <option value="all">All statuses</option>
        <option v-for="status in postStatuses" :key="status" :value="status">
          {{ statusLabels[status] }}
        </option>
      </select>
    </div>
    <label><input v-model="filters.followUp" type="checkbox" /> Needs follow-up</label
    ><UiButton type="submit">Apply queue filters</UiButton>
  </form>
  <p class="field-help">
    Needs follow-up shows member comments since the latest official response. Select All statuses to
    check follow-up across the workflow.
  </p>
  <p v-if="error" role="alert">
    {{ error }} <UiButton type="button" @click="load()">Retry queue</UiButton>
  </p>
  <p v-if="loading" role="status">Loading queue…</p>
  <p v-else-if="loaded && !posts.length">No feedback needs review with these filters.</p>
  <ol class="feedback-list">
    <li v-for="post in posts" :key="post.id" class="panel feedback-card">
      <p>{{ post.category.name }} · {{ statusLabels[post.status] }}</p>
      <h2><NuxtLink :to="`/feedback/${post.id}`">{{ post.title }}</NuxtLink></h2>
      <p>{{ post.excerpt }}</p>
    </li>
  </ol>
  <UiButton v-if="cursor" type="button" :busy="loading" @click="load(true)">
    Load more review items
  </UiButton>
</template>
