<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'quiet' | 'tab'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    busy?: boolean
  }>(),
  { variant: 'default', type: 'button', disabled: false, busy: false },
)
</script>

<template>
  <button
    class="ui-button"
    :class="`ui-button-${variant}`"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
  >
    <slot />
  </button>
</template>
