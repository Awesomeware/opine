<script setup lang="ts">
import { statusLabels, postStatuses } from '../../../shared/status'
import type { FeedbackCategory, FeedbackPage, FeedbackPostSummary } from '../../../shared/contracts'

useHead({ title: 'Community feedback · Opine' })
const route = useRoute()
const query = computed(() => ({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  category: typeof route.query.category === 'string' ? route.query.category : '',
  status: typeof route.query.status === 'string' ? route.query.status : '',
  limit: 20,
}))
const filters = reactive({
  q: query.value.q,
  category: query.value.category,
  status: query.value.status,
})
watch(query, (value) => Object.assign(filters, value))
const { data: categories, error: categoriesError } = useFetch<{ categories: FeedbackCategory[] }>(
  '/api/feedback/categories',
)
const { data, pending, error, refresh } = useFetch<FeedbackPage>('/api/feedback/posts', { query })
const extraPosts = ref<FeedbackPostSummary[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
const moreError = ref('')
watch(
  data,
  (value) => {
    moreError.value = ''
    extraPosts.value = []
    nextCursor.value = value?.nextCursor ?? null
  },
  { immediate: true },
)
watch(query, () => {
  moreError.value = ''
})
const posts = computed(() => [...(data.value?.posts ?? []), ...extraPosts.value])

async function applyFilters() {
  await navigateTo({
    path: '/feedback',
    query: {
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
  })
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  const currentQuery = JSON.stringify(query.value)
  loadingMore.value = true
  moreError.value = ''
  try {
    const page = await $fetch<FeedbackPage>('/api/feedback/posts', {
      query: { ...query.value, cursor: nextCursor.value },
    })
    if (currentQuery !== JSON.stringify(query.value)) return
    extraPosts.value.push(...page.posts)
    nextCursor.value = page.nextCursor
  } catch {
    if (currentQuery === JSON.stringify(query.value)) {
      moreError.value = 'Unable to load more feedback. Please try again.'
    }
  } finally {
    loadingMore.value = false
  }
}
</script>

<template>
  <main id="main-content" class="content-column">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Help improve the game</p>
        <h1>Community feedback</h1>
      </div>
      <NuxtLink class="button button-primary" to="/feedback/new">Share feedback</NuxtLink>
    </div>
    <p class="intro">Share feedback, suggest improvements, and discuss the game.</p>
    <form class="panel filters" role="search" @submit.prevent="applyFilters">
      <div class="field search-field">
        <label for="search">Search feedback</label
        ><input id="search" v-model="filters.q" type="search" placeholder="Find feedback…" />
      </div>
      <div class="field">
        <label for="category-filter">Category</label
        ><select id="category-filter" v-model="filters.category">
          <option value="">All categories</option>
          <option
            v-for="category in categories?.categories"
            :key="category.id"
            :value="category.slug"
          >
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="status-filter">Status</label
        ><select id="status-filter" v-model="filters.status">
          <option value="">All statuses</option>
          <option v-for="status in postStatuses" :key="status" :value="status">
            {{ statusLabels[status] }}
          </option>
        </select>
      </div>
      <button type="submit">Apply filters</button>
    </form>
    <p v-if="categoriesError" role="alert">
      Categories could not be loaded. You can still search feedback.
    </p>
    <p class="list-caption">Newest feedback first</p>
    <p v-if="pending" role="status">Loading feedback…</p>
    <div v-else-if="error" class="panel notice" role="alert">
      <p>Unable to load feedback. Please try again.</p>
      <button type="button" @click="refresh()">Retry</button>
    </div>
    <template v-else>
      <div v-if="!posts.length" class="panel empty-state">
        <h2>No feedback found</h2>
        <p>Try another search or share your own feedback.</p>
        <NuxtLink to="/feedback/new">Share feedback</NuxtLink>
      </div>
      <ol v-else class="feedback-list">
        <li v-for="post in posts" :key="post.id" class="panel feedback-card">
          <div class="post-meta">
            <span>{{ post.category.name }}</span
            ><span class="status-badge">{{ statusLabels[post.status] }}</span>
          </div>
          <h2><NuxtLink :to="`/feedback/${post.id}`">{{ post.title }}</NuxtLink></h2>
          <p class="excerpt">{{ post.excerpt }}</p>
          <p class="byline">
            <strong>{{ post.author.name }}</strong><span aria-hidden="true"> · </span
            ><time :datetime="post.createdAt">{{
              new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
            }}</time>
          </p>
        </li>
      </ol>
      <p v-if="moreError" role="alert">{{ moreError }}</p>
      <div v-if="nextCursor" class="load-more">
        <button type="button" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Loading…' : 'Load more feedback' }}
        </button>
      </div>
    </template>
  </main>
</template>
