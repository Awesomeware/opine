<script setup lang="ts">
withDefaults(
  defineProps<{ as?: 'span' | 'strong'; tone?: 'neutral' | 'review' | 'planned' | 'complete' }>(),
  { as: 'span', tone: 'neutral' },
)
</script>

<template>
  <component :is="as" class="ui-badge" :class="tone"><slot /></component>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 7px;
  border: 1px solid var(--color-badge-border);
  border-radius: var(--radius-small);
  color: var(--color-badge-text);
  background: var(--color-badge-background);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
.review {
  color: var(--color-review-text);
  background: var(--color-review-background);
}
.planned {
  color: var(--color-planned-text);
  background: var(--color-planned-background);
}
.complete {
  color: var(--color-official);
  background: var(--color-official-background);
}
</style>
