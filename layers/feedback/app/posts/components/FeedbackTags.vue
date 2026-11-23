<script setup lang="ts">
import type { FeedbackTag } from '../../../shared/posts/contracts'
import UiBadge from '../../../../ui/app/components/UiBadge.vue'

defineProps<{ tags: FeedbackTag[] }>()
</script>

<template>
  <ul v-if="tags.length" class="tags" aria-label="Tags">
    <li v-for="tag in tags" :key="tag.id">
      <UiBadge shape="pill" :icon="tag.icon">{{ tag.name }}</UiBadge>
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
}
</style>
