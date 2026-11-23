<script setup lang="ts">
import FeedbackOfficialResponse from '../../review/components/FeedbackOfficialResponse.vue'
import { ref, watch, nextTick } from 'vue'
import {
  contributionTypes,
  contributionFilterLabels,
} from '../../../shared/discussion/contribution-types'
import { useFeedbackDiscussion } from '../composables/useFeedbackDiscussion'
import FeedbackContributionItem from './FeedbackContributionItem.vue'
import FeedbackCommentComposer from './FeedbackCommentComposer.vue'

const props = defineProps<{ postId: string; owner: string | null; locked: boolean }>()
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
const heading = ref<HTMLHeadingElement | null>(null)
const items = ref<HTMLDivElement | null>(null)

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

async function loadMore() {
  const previousCount = entries.value.length
  const focusedElement = document.activeElement
  await loadComments(true)
  await nextTick()
  if (
    !error.value &&
    (document.activeElement === focusedElement || document.activeElement === document.body)
  ) {
    // A linked entry can sit outside the page, so resolve the appended entry's visible position.
    const nextEntry = entries.value[previousCount]
    const index = nextEntry ? visibleEntries.value.indexOf(nextEntry) : -1
    const firstNewItem = items.value?.children.item(index)
    if (firstNewItem instanceof HTMLElement) {
      firstNewItem.focus()
    }
  }
}

async function refreshEditedComment() {
  // Let the editor return focus before refreshing; its row may leave this filter/page.
  await nextTick()
  const focusedElement = document.activeElement
  await retryComments()
  await nextTick()
  if (focusedElement && !focusedElement.isConnected && document.activeElement === document.body) {
    heading.value?.focus()
  }
}

function focusComposer() {
  composer.value?.focus()
}

defineExpose({ refresh: retryComments, focusComposer })
</script>
<template>
  <section class="participation" aria-labelledby="comments-heading">
    <h2 id="comments-heading" ref="heading" tabindex="-1">Community contributions</h2>
    <nav class="discussion-filters" aria-label="Filter contributions">
      <Button variant="tab" type="button" :aria-pressed="!filter" @click="selectFilter()">
        All
      </Button>
      <Button
        variant="tab"
        v-for="kind in contributionTypes"
        :key="kind"
        type="button"
        :aria-pressed="filter === kind"
        @click="selectFilter(kind)"
      >
        {{ contributionFilterLabels[kind] }}
      </Button>
      <Button
        variant="tab"
        type="button"
        :aria-pressed="filter === 'team'"
        @click="selectFilter('team')"
      >
        Official responses
      </Button>
    </nav>
    <p class="field-help">Oldest first. Context, questions, and differing views are welcome.</p>
    <p v-if="error || targetError" role="alert">
      {{ error || targetError }}
      <Button type="button" @click="retryComments">Retry comments</Button>
    </p>
    <p v-if="loading" role="status">Loading comments…</p>
    <p v-else-if="loaded && !entries.length" role="status">
      {{ filter ? 'No contributions of this type yet.' : 'No contributions yet.' }}
    </p>
    <div ref="items">
      <template
        v-for="entry in visibleEntries"
        :key="entry.kind === 'comment' ? entry.comment.id : entry.response.id"
      >
        <FeedbackOfficialResponse
          tabindex="-1"
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
          tabindex="-1"
          v-else
          :comment="entry.comment"
          :owner="owner"
          :linked="route.query.comment === entry.comment.id"
          :outside="
            target?.id === entry.comment.id &&
            !comments.some((comment) => comment.id === entry.comment.id)
          "
          :outside-filter="!!filter && entry.comment.type !== filter"
          @saved="refreshEditedComment"
        />
      </template>
    </div>
    <Button v-if="nextCursor" type="button" :busy="loading" :disabled="loading" @click="loadMore">
      Load more comments
    </Button>
    <FeedbackCommentComposer
      v-if="!locked"
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
