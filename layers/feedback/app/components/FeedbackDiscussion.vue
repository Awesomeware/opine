<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { contributionTypes, contributionFilterLabels } from '../../shared/contribution-types'
import { useFeedbackDiscussion } from '../composables/useFeedbackDiscussion'
import FeedbackContributionItem from './FeedbackContributionItem.vue'
import FeedbackCommentComposer from './FeedbackCommentComposer.vue'

const props = defineProps<{ postId: string; owner: string | null }>()
const route = useRoute()
const {
  entries,
  comments,
  targetResponse,
  target,
  nextCursor,
  loaded,
  loading,
  error,
  targetError,
  filter,
  visibleEntries,
  loadComments,
  retryComments,
  selectFilter,
} = useFeedbackDiscussion(props.postId)
const composer = ref<InstanceType<typeof FeedbackCommentComposer> | null>(null)

watch([target, targetResponse], async () => {
  await nextTick()
  const id = targetResponse.value
    ? `response-${targetResponse.value.id}`
    : target.value
      ? `comment-${target.value.id}`
      : null
  if (id) {
    document.getElementById(id)?.scrollIntoView({ block: 'center' })
  }
})

function focusComposer() {
  composer.value?.focus()
}

defineExpose({ refresh: retryComments, focusComposer })
</script>
<template>
  <section class="participation" aria-labelledby="comments-heading">
    <h2 id="comments-heading">Community contributions</h2>
    <nav class="discussion-filters" aria-label="Filter contributions">
      <UiButton variant="tab" type="button" :aria-pressed="!filter" @click="selectFilter()">
        All
      </UiButton>
      <UiButton
        variant="tab"
        v-for="kind in contributionTypes"
        :key="kind"
        type="button"
        :aria-pressed="filter === kind"
        @click="selectFilter(kind)"
      >
        {{ contributionFilterLabels[kind] }}
      </UiButton>
      <UiButton
        variant="tab"
        type="button"
        :aria-pressed="filter === 'team'"
        @click="selectFilter('team')"
      >
        Official responses
      </UiButton>
    </nav>
    <p class="field-help">Oldest first. Context, questions, and differing views are welcome.</p>
    <p v-if="error || targetError" role="alert">
      {{ error || targetError }}
      <UiButton type="button" @click="retryComments">Retry comments</UiButton>
    </p>
    <p v-if="loading">Loading comments…</p>
    <p v-else-if="loaded && !entries.length">
      {{ filter ? 'No contributions of this type yet.' : 'No contributions yet.' }}
    </p>
    <template
      v-for="entry in visibleEntries"
      :key="entry.kind === 'comment' ? entry.comment.id : entry.response.id"
    >
      <FeedbackOfficialResponse
        v-if="entry.kind === 'response'"
        :response="entry.response"
        :linked="route.query.response === entry.response.id"
        :outside="
          !entries.some(
            (item) => item.kind === 'response' && item.response.id === entry.response.id,
          )
        "
      >
        <template #link="{ href }"><NuxtLink :to="href">Response link</NuxtLink></template>
      </FeedbackOfficialResponse>
      <FeedbackContributionItem
        v-else
        :comment="entry.comment"
        :owner="owner"
        :linked="route.query.comment === entry.comment.id"
        :outside="
          target?.id === entry.comment.id &&
          !comments.some((comment) => comment.id === entry.comment.id)
        "
        :outside-filter="!!filter && entry.comment.type !== filter"
        @saved="retryComments"
      />
    </template>
    <UiButton
      v-if="nextCursor"
      type="button"
      :busy="loading"
      :disabled="loading"
      @click="loadComments(true)"
    >
      Load more comments
    </UiButton>
    <FeedbackCommentComposer
      ref="composer"
      :post-id="postId"
      :owner="owner"
      :refresh="loadComments"
    />
  </section>
</template>
<style scoped>
.participation {
  margin-top: 2rem;
}
h2 {
  font-size: 1.5rem;
  margin: 0 0 0.75rem;
}
.discussion-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.9rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.75rem;
}
.participation > .field-help {
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
</style>
