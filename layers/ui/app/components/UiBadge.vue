<script setup lang="ts">
withDefaults(defineProps<{ as?: 'span' | 'strong' }>(), { as: 'span' })
</script>

<template>
  <component :is="as" class="ui-badge"><slot /></component>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 3px var(--space-3);
  border: 1px solid var(--color-badge-border);
  border-radius: var(--radius-small);
  color: var(--color-badge-text);
  background: var(--color-badge-background);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
