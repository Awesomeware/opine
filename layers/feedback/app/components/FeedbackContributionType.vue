<script setup lang="ts">
import {
  contributionTypes,
  contributionLabels,
  contributionPrompts,
  type ContributionType,
} from '../../shared/contribution-types'
defineProps<{ name: string; disabled?: boolean; error?: string; legacy?: boolean }>()
const model = defineModel<ContributionType | ''>({ required: true })
</script>
<template>
  <fieldset :disabled="disabled" :aria-describedby="error ? `${name}-error` : undefined">
    <legend>Contribution type</legend>
    <p v-if="legacy" class="field-help">
      This older comment is unspecified. Choose a type to classify it, or leave it unchanged.
    </p>
    <div class="type-options">
      <label v-for="type in contributionTypes" :key="type" :class="{ selected: model === type }">
        <input v-model="model" type="radio" :name="name" :value="type" :aria-invalid="!!error" />
        {{ contributionLabels[type] }}
      </label>
    </div>
    <p v-if="model" class="field-help">{{ contributionPrompts[model] }}</p>
    <p v-else class="field-help">Choose how you want to contribute to this feedback.</p>
    <p v-if="error" :id="`${name}-error`" class="field-error">{{ error }}</p>
  </fieldset>
</template>
<style scoped>
fieldset {
  border: 0;
  padding: 0;
  min-width: 0;
}
legend {
  font-weight: 700;
  margin-bottom: 0.75rem;
}
.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.type-options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  padding: 0.65rem;
  cursor: pointer;
}
.type-options input {
  width: auto;
  min-height: auto;
  margin: 0;
  padding: 0;
  accent-color: var(--color-accent);
}
.selected {
  outline: 2px solid currentColor;
  outline-offset: -2px;
}
.field-help {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}
.field-error {
  color: var(--color-error);
  font-size: 0.9rem;
  margin: 0;
}
</style>
