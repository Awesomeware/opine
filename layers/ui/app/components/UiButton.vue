<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'default' | 'primary'
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
    :class="{ primary: variant === 'primary' }"
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
.ui-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: var(--ui-button-min-height, 44px);
  padding: var(--ui-button-padding, 9px 18px);
  border: 1px solid var(--color-control-border);
  border-radius: var(--radius-control);
  background: var(--color-control);
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  font-weight: 600;
  line-height: 1.4;
}
.ui-button:hover {
  background: var(--color-control-hover);
  border-color: var(--color-accent);
}
.ui-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ui-button[aria-busy='true'] {
  cursor: wait;
}
.primary {
  background: linear-gradient(var(--color-action-start), var(--color-action-end));
  border-color: var(--color-action-border);
  color: var(--color-on-action);
}
.primary:hover {
  background: var(--color-action-hover);
  color: var(--color-on-action);
}
</style>
