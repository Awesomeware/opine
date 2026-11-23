<script setup lang="ts">
import type { FeedbackTag } from '../../../shared/posts/contracts'

defineProps<{ tags: FeedbackTag[] }>()
</script>

<template>
  <ul v-if="tags.length" class="tags" aria-label="Tags">
    <li v-for="tag in tags" :key="tag.id">
      <span v-if="tag.icon" aria-hidden="true">{{ tag.icon }}</span>
      <span>{{ tag.name }}</span>
    </li>
  </ul>
</template>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  gap: 6px;
  padding: 0;
  margin: 8px 0;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 999px;
}
</style>
