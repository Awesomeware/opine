<script setup lang="ts">
import { statusLabels } from '../../../shared/status'
import type { FeedbackPost } from '../../../shared/contracts'

const route = useRoute()
const { data, pending, error, refresh } = useFetch<{ post: FeedbackPost }>(
  () => `/api/feedback/posts/${encodeURIComponent(String(route.params.id))}`,
)
const post = computed(() => data.value?.post)
useHead(() => ({ title: post.value ? `${post.value.title} · Opine` : 'Feedback · Opine' }))
const shareMessage = ref('')
async function copyLink() {
  try {
    await navigator.clipboard.writeText(
      new URL(`/feedback/${post.value?.id}`, window.location.origin).href,
    )
    shareMessage.value = 'Link copied.'
  } catch {
    shareMessage.value = 'Unable to copy. You can copy this page’s address from your browser.'
  }
}
</script>

<template>
  <main id="main-content" class="content-column detail-column">
    <NuxtLink class="back-link" to="/feedback">← All feedback</NuxtLink>
    <p v-if="pending" role="status">Loading feedback…</p>
    <div v-else-if="error" class="panel empty-state" role="alert">
      <template v-if="error.statusCode === 404"
        ><h1>Feedback not found</h1>
        <p>This feedback is not available. Browse other feedback from the community.</p></template
      >
      <template v-else
        ><h1>Unable to load feedback</h1>
        <p>Please try again.</p>
        <button type="button" @click="refresh()">Retry</button></template
      >
    </div>
    <article v-else-if="post">
      <p class="eyebrow">{{ post.category.name }}</p>
      <h1>{{ post.title }}</h1>
      <p class="byline">
        <strong>{{ post.author.name }}</strong><span aria-hidden="true"> · </span
        ><time :datetime="post.createdAt">{{
          new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })
        }}</time>
      </p>
      <div class="prose">
        <p>{{ post.description }}</p>
        <template v-if="post.desiredImprovement"
          ><h2>Suggested improvement</h2>
          <p>{{ post.desiredImprovement }}</p></template
        >
      </div>
      <div class="detail-actions">
        <span class="status-badge">{{ statusLabels[post.status] }}</span
        ><button type="button" @click="copyLink">Copy link</button>
      </div>
      <p v-if="shareMessage" role="status">{{ shareMessage }}</p>
    </article>
  </main>
</template>
