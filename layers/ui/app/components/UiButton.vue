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
    :class="variant"
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
  gap: 7px;
  min-height: var(--ui-button-min-height, 38px);
  padding: var(--ui-button-padding, 7px 14px);
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
  background: var(--color-action-start);
  border-color: var(--color-action-border);
  color: var(--color-on-action);
}
.primary:hover {
  background: var(--color-action-hover);
  color: var(--color-on-action);
}
.quiet,
.tab {
  border-color: transparent;
  background: transparent;
  font-weight: 400;
}
.quiet:hover,
.tab:hover {
  border-color: transparent;
  background: var(--color-control-hover);
}
.tab {
  border-radius: 0;
  border-bottom: 3px solid transparent;
}
.tab[aria-pressed='true'] {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
  font-weight: 600;
}
</style>
