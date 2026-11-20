<script setup lang="ts">
import { authClient } from '../../../../auth/app/auth-client'
import type { FeedbackPost } from '../../../shared/contracts'

const route = useRoute()
const session = authClient.useSession()
const owner = computed(() => session.value.data?.user.id ?? null)
const editing = ref(false)
const discussion = ref<{ refresh: () => Promise<void> } | null>(null)
watch(owner, () => {
  editing.value = false
  data.value = undefined
  refresh()
})
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
        <UiButton type="button" @click="refresh()">Retry</UiButton></template
      >
    </div>
    <article v-else-if="post">
      <p class="eyebrow">{{ post.category.name }}</p>
      <h1>{{ post.title }}</h1>
      <p class="byline">
        <strong>{{ post.author.name }}</strong><span aria-hidden="true"> · </span
        ><time :datetime="post.createdAt">{{
          new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })
        }}</time
        ><span v-if="post.editedAt" :title="new Date(post.editedAt).toLocaleString()">
          · Edited</span
        >
      </p>
      <FeedbackEditor
        v-if="editing && owner"
        :key="owner"
        :owner="owner"
        :endpoint="`/api/feedback/posts/${post.id}`"
        :title="post.title"
        :description="post.description"
        :desired-improvement="post.desiredImprovement"
        :version="post.version"
        @saved="
          editing = false;
          refresh()
        "
        @cancel="editing = false"
      />
      <div v-else class="prose">
        <FeedbackText :text="post.description" />
        <template v-if="post.desiredImprovement"
          ><h2>Suggested improvement</h2>
          <FeedbackText :text="post.desiredImprovement"
        /></template>
      </div>
      <div class="detail-actions">
        <UiButton type="button" @click="copyLink">Copy link</UiButton
        ><UiButton v-if="post.canEdit && owner && !editing" type="button" @click="editing = true">
          Edit feedback
        </UiButton>
      </div>
      <p v-if="shareMessage" role="status">{{ shareMessage }}</p>
    </article>
    <FeedbackOutcome
      v-if="post"
      :key="`outcome.${post.id}.${owner}`"
      :category-id="post.category.id"
      :post-id="post.id"
      :owner="owner"
      @published="
        discussion?.refresh();
        refresh()
      "
    />
    <FeedbackDiscussion
      ref="discussion"
      v-if="post"
      :key="`${post.id}.${owner}`"
      :post-id="post.id"
      :owner="owner"
    />
  </main>
</template>
