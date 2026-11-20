<script setup lang="ts">
import { computed } from 'vue'
import type { OfficialResponse } from '../../shared/contracts'
import { statusLabels } from '../../shared/status'
import FeedbackText from './FeedbackText.vue'
import FeedbackStatusBadge from './FeedbackStatusBadge.vue'
const props = defineProps<{
  response: OfficialResponse
  featured?: boolean
  linked?: boolean
  outside?: boolean
}>()
const responseHref = computed(
  () =>
    `/feedback/${props.response.postId}?response=${props.response.id}#response-${props.response.id}`,
)
</script>
<template>
  <article
    :id="featured ? undefined : `response-${response.id}`"
    class="official-response"
    :class="{ linked }"
  >
    <p v-if="outside" class="outside">
      Linked official response · outside the selected filter or current page
    </p>
    <header>
      <h3>Official response</h3>
      <FeedbackStatusBadge v-if="response.status" :status="response.status" />
    </header>
    <p class="response-byline">
      <strong>{{ response.author.name }}</strong> ·
      <time :datetime="response.createdAt">{{
        new Date(response.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
      }}</time>
    </p>
    <FeedbackText :text="response.body" />
    <footer>
      <slot name="link" :href="responseHref"><a :href="responseHref">Response link</a></slot>
      <span v-if="response.status && response.previousStatus" class="status-change"
        >{{ statusLabels[response.previousStatus] }} → {{ statusLabels[response.status] }}</span
      >
    </footer>
  </article>
</template>
<style scoped>
.official-response {
  background: var(--color-official-background);
  border-left: 3px solid var(--color-official);
  padding: 1rem 1.25rem;
  margin: 1rem 0;
  overflow-wrap: anywhere;
  scroll-margin-top: 2rem;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
}
h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
}
.response-byline {
  margin: 0.2rem 0 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.response-byline strong {
  font-weight: 400;
}
footer {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.8rem;
}
a,
:slotted(a) {
  color: var(--color-official);
}
.status-change,
.outside {
  color: var(--color-text-muted);
}
.outside {
  font-size: 0.8rem;
}
.linked {
  outline: 2px solid var(--color-official);
  outline-offset: 3px;
}
</style>
