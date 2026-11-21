<script setup lang="ts">
import FeedbackContributionIcon from './FeedbackContributionIcon.vue'
import {
  contributionTypes,
  contributionLabels,
  contributionPrompts,
  type ContributionType,
} from '../../../shared/discussion/contribution-types'

defineProps<{ name: string; disabled?: boolean; error?: string; legacy?: boolean }>()

const model = defineModel<ContributionType | ''>({ required: true })
</script>

<template>
  <fieldset :disabled="disabled" :aria-describedby="`${name}-help${error ? ` ${name}-error` : ''}`">
    <legend>Contribution type</legend>
    <p v-if="legacy" class="field-help">
      This older comment is unspecified. Choose a type to classify it, or leave it unchanged.
    </p>
    <div class="type-options">
      <label v-for="type in contributionTypes" :key="type" :class="{ selected: model === type }">
        <input
          v-model="model"
          type="radio"
          :name="name"
          :value="type"
          :required="!legacy"
          :aria-invalid="!!error"
          :aria-describedby="`${name}-help${error ? ` ${name}-error` : ''}`"
        />
        <FeedbackContributionIcon :type="type" />
        {{ contributionLabels[type] }}
      </label>
    </div>
    <p v-if="model" :id="`${name}-help`" class="field-help">{{ contributionPrompts[model] }}</p>
    <p v-else :id="`${name}-help`" class="field-help">
      Choose how you want to contribute to this feedback.
    </p>
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
  font-weight: var(--font-weight-bold);
  margin-bottom: 0.75rem;
}
.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.type-options label {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: 0.5rem 0.65rem;
  min-height: 44px;
  font-size: 0.85rem;
  flex: 1 1 auto;
  cursor: pointer;
}
.type-options input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: inherit;
  margin: 0;
  min-height: 0;
  padding: 0;
}
.type-options label.selected {
  border-color: var(--color-accent);
  background: var(--color-selected-background);
  color: var(--color-accent);
  font-weight: var(--font-weight-bold);
}
.type-options label:has(input:focus-visible) {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}
fieldset:disabled .type-options label {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
