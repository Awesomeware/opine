<script setup lang="ts">
import { nextTick } from 'vue'
import FeedbackPostRow from '../../posts/components/FeedbackPostRow.vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { statusLabels, postStatuses } from '../../../shared/status'
import type {
  FeedbackCategory,
  FeedbackPage,
  FeedbackPostSummary,
} from '../../../shared/posts/contracts'

useHead({ title: 'Community feedback · Opine' })

const route = useRoute()
const query = computed(() => ({
  q: typeof route.query.q === 'string' ? route.query.q : '',
  category: typeof route.query.category === 'string' ? route.query.category : '',
  status: typeof route.query.status === 'string' ? route.query.status : '',
  limit: 20,
}))

// Draft filter controls become active only when applied to the URL.
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

const pagination = useRequestScope()
const extraPosts = ref<FeedbackPostSummary[]>([])
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
const items = ref<HTMLOListElement | null>(null)
const moreError = ref('')

watch(
  data,
  (value) => {
    pagination.startRequest()
    loadingMore.value = false
    moreError.value = ''
    extraPosts.value = []
    nextCursor.value = value?.nextCursor ?? null
  },
  { immediate: true },
)

watch(query, () => {
  pagination.startRequest()
  loadingMore.value = false
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
  if (!nextCursor.value || loadingMore.value) {
    return
  }

  const previousCount = posts.value.length
  const focusedElement = document.activeElement
  const isCurrent = pagination.startRequest()
  loadingMore.value = true
  moreError.value = ''

  try {
    const page = await $fetch<FeedbackPage>('/api/feedback/posts', {
      query: { ...query.value, cursor: nextCursor.value },
    })
    if (!isCurrent()) {
      return
    }

    extraPosts.value.push(...page.posts)
    nextCursor.value = page.nextCursor
    await nextTick()
    if (document.activeElement === focusedElement || document.activeElement === document.body) {
      const firstNewItem = items.value?.children.item(previousCount)
      if (firstNewItem instanceof HTMLElement) {
        firstNewItem.focus()
      }
    }
  } catch {
    if (isCurrent()) {
      moreError.value = 'Unable to load more feedback. Please try again.'
    }
  } finally {
    if (isCurrent()) {
      loadingMore.value = false
    }
  }
}
</script>

<template>
  <main id="main-content" tabindex="-1" class="content-column">
    <div class="page-heading">
      <div>
        <h1>Community feedback</h1>
      </div>
      <NuxtLink class="ui-button ui-button-primary" to="/feedback/new">Share feedback</NuxtLink>
    </div>
    <form class="filters" role="search" @submit.prevent="applyFilters">
      <div class="field search-field">
        <label for="search">Search feedback</label>
        <input id="search" v-model="filters.q" type="search" placeholder="Find feedback…" />
      </div>
      <div class="field">
        <label for="category-filter">Category</label>
        <select id="category-filter" v-model="filters.category">
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
        <label for="status-filter">Status</label>
        <select id="status-filter" v-model="filters.status">
          <option value="">All statuses</option>
          <option v-for="status in postStatuses" :key="status" :value="status">
            {{ statusLabels[status] }}
          </option>
        </select>
      </div>
      <Button type="submit">Apply filters</Button>
    </form>
    <p v-if="categoriesError" role="alert">
      Categories could not be loaded. You can still search feedback.
    </p>
    <p class="list-caption">Newest feedback first</p>
    <p v-if="pending" role="status">Loading feedback…</p>
    <Notice v-else-if="error" as="div" role="alert">
      <p>Unable to load feedback. Please try again.</p>
      <Button type="button" @click="refresh()">Retry</Button>
    </Notice>
    <template v-else>
      <div v-if="!posts.length" class="panel empty-state">
        <h2>No feedback found</h2>
        <p>Try another search or share your own feedback.</p>
        <NuxtLink to="/feedback/new">Share feedback</NuxtLink>
      </div>
      <ol v-else ref="items" class="feedback-list">
        <li v-for="post in posts" :key="post.id" tabindex="-1">
          <FeedbackPostRow :post="post">
            <template #title>
              <NuxtLink :to="`/feedback/${post.id}`">{{ post.title }}</NuxtLink>
            </template>
          </FeedbackPostRow>
        </li>
      </ol>
      <p v-if="moreError" role="alert">{{ moreError }}</p>
      <div v-if="nextCursor" class="load-more">
        <Button type="button" :busy="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Loading…' : 'Load more feedback' }}
        </Button>
      </div>
    </template>
  </main>
</template>

<style scoped>
.content-column {
  max-width: 1040px;
  padding-top: 34px;
}
.page-heading {
  margin-bottom: 24px;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: clamp(1.7rem, 3vw, 2.15rem);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 12px;
  margin-bottom: 20px;
}
.filters .field {
  flex: 1;
  min-width: 150px;
}
.filters .search-field {
  flex: 2;
  min-width: 220px;
}
.filters label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.filters input,
.filters select {
  min-height: 38px;
  padding: 6px 10px;
  font-size: 0.85rem;
}
.list-caption {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  margin-bottom: 8px;
}
.feedback-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border-top: 1px solid var(--color-border);
}
.empty-state {
  padding: 36px;
  text-align: center;
}
.load-more {
  text-align: center;
  margin: 28px 0;
}
@media (max-width: 650px) {
  .page-heading {
    display: flex;
    flex-wrap: wrap;
  }
  .page-heading .ui-button {
    margin: 0;
  }
  .filters .field {
    min-width: 140px;
  }
  .filters .search-field {
    flex-basis: 100%;
  }
}
</style>
