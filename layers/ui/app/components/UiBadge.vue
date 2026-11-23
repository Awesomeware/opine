<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: 'span' | 'strong'
    tone?: 'neutral' | 'review' | 'planned' | 'complete'
    shape?: 'rounded' | 'pill'
    icon?: string | null
  }>(),
  { as: 'span', tone: 'neutral', shape: 'rounded', icon: null },
)
</script>

<template>
  <component :is="as" class="ui-badge" :class="[tone, shape]">
    <span v-if="icon" aria-hidden="true">{{ icon }}</span>
    <slot />
  </component>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 2px 7px;
  border: 1px solid var(--color-badge-border);
  border-radius: var(--radius-small);
  color: var(--color-badge-text);
  background: var(--color-badge-background);
  font-size: 0.8rem;
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}
.pill {
  padding: 4px 10px;
  border-color: var(--color-border);
  border-radius: 999px;
  line-height: 1.4;
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
