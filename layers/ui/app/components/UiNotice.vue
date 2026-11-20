<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ as?: 'p' | 'div' }>(), { as: 'p' })
const element = ref<HTMLElement | null>(null)
// Forms focus their error summary after validation without exposing component internals.
defineExpose({ focus: () => element.value?.focus() })
</script>

<template>
  <component :is="as" ref="element" class="ui-notice"><slot /></component>
</template>

<style scoped>
.ui-notice {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-notice-border);
  border-radius: var(--radius-control);
  background: var(--color-notice-background);
}
</style>
