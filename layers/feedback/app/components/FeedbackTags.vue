<script setup lang="ts">
import type { FeedbackTag } from '../../shared/contracts'

defineProps<{ tags: FeedbackTag[] }>()
</script>

<template>
  <ul v-if="tags.length" class="tags" aria-label="Tags">
    <li v-for="tag in tags" :key="tag.id">{{ tag.name }}</li>
  </ul>
</template>

<style scoped>
.tags {
  display: flex;
  flex-wrap: wrap;
  list-style: none;
  gap: 6px 12px;
  padding: 0;
  margin: 8px 0;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
li {
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-small);
}
</style>
