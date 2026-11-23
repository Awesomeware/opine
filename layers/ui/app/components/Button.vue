<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'quiet' | 'tab'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    busy?: boolean
    hoverHighlight?: boolean
  }>(),
  { variant: 'default', type: 'button', disabled: false, busy: false, hoverHighlight: false },
)

const element = ref<HTMLButtonElement | null>(null)

// Restore focus when an inline form closes or replaces its action button.
defineExpose({ focus: () => element.value?.focus() })
</script>

<template>
  <button
    ref="element"
    class="ui-button"
    :class="[`ui-button-${variant}`, { 'ui-hover-highlight': hoverHighlight }]"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
  >
    <slot />
  </button>
</template>
