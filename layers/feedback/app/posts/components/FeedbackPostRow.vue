<script setup lang="ts">
import FeedbackTags from './FeedbackTags.vue'
import FeedbackStatusBadge from '../../review/components/FeedbackStatusBadge.vue'
import type { FeedbackPostSummary } from '../../../shared/posts/contracts'

defineProps<{ post: FeedbackPostSummary }>()
</script>

<template>
  <article class="post-row">
    <div class="post-content">
      <h2>
        <slot name="title"><a :href="`/feedback/${post.id}`">{{ post.title }}</a></slot>
      </h2>
      <p class="row-excerpt">{{ post.excerpt }}</p>
      <FeedbackTags :tags="post.tags" />
      <p class="row-byline">
        <span v-if="post.lockedAt">Locked ·</span>
        <span>{{ post.category.name }}</span>
        <span aria-hidden="true">·</span>
        <span>{{ post.author.name }}</span>
        <span aria-hidden="true">·</span>
        <time :datetime="post.createdAt">
          {{ new Date(post.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) }}
        </time>
      </p>
    </div>
    <FeedbackStatusBadge class="row-status" :status="post.status" />
  </article>
</template>

<style scoped>
.post-row {
  display: flex;
  gap: var(--space-5);
  justify-content: space-between;
  align-items: flex-start;
  padding: 18px 4px;
  border-bottom: 1px solid var(--color-border);
}
.post-content {
  min-width: 0;
}
h2 {
  font-family: var(--font-body);
  font-size: 1.05rem;
  line-height: 1.4;
  margin: 0 0 3px;
}
h2 a,
h2 :slotted(a) {
  color: var(--color-text);
  text-decoration: none;
}
h2 a:hover,
h2 :slotted(a:hover) {
  color: var(--color-accent);
  text-decoration: underline;
}
.row-excerpt {
  margin: 0 0 6px;
  color: var(--color-text);
  font-size: 0.95rem;
  overflow-wrap: anywhere;
}
.row-byline {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.35em;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.row-status {
  flex-shrink: 0;
  margin-top: 4px;
}
@media (max-width: 480px) {
  .post-row {
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .row-status {
    margin-top: 0;
  }
}
</style>
