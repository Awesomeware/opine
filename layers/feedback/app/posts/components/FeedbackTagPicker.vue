<script setup lang="ts">
import { computed } from 'vue'
import type { FeedbackTag } from '../../../shared/posts/contracts'

const props = withDefaults(
  defineProps<{
    tags: FeedbackTag[]
    retainedIds?: string[]
    disabled?: boolean
    error?: string
    name: string
  }>(),
  { retainedIds: () => [] },
)

const model = defineModel<string[]>({ required: true })

const choices = computed(() =>
  props.tags.filter(
    (tag) => tag.isActive || props.retainedIds.includes(tag.id) || model.value.includes(tag.id),
  ),
)
const unknownIds = computed(() =>
  model.value.filter((id) => !props.tags.some((tag) => tag.id === id)),
)
</script>

<template>
  <fieldset :disabled="disabled" :aria-describedby="`${name}-help${error ? ` ${name}-error` : ''}`">
    <legend>Tags (optional)</legend>
    <p :id="`${name}-help`" class="help">Choose any that apply, or leave this feedback untagged.</p>
    <div class="choices">
      <label v-for="tag in choices" :key="tag.id">
        <input
          type="checkbox"
          :name="name"
          :value="tag.id"
          v-model="model"
          :aria-invalid="!!error"
        />
        <span v-if="tag.icon" aria-hidden="true">{{ tag.icon }}</span>
        {{ tag.name }}
        <span v-if="!tag.isActive">(inactive)</span>
      </label>
      <label v-for="id in unknownIds" :key="id">
        <input v-model="model" type="checkbox" :name="name" :value="id" />
        Unavailable tag (remove)
      </label>
    </div>
    <p v-if="!choices.length && !unknownIds.length" class="help">No tags are available.</p>
    <p v-if="error" :id="`${name}-error`" class="field-error">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
legend {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 6px;
}
.help {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0 0 10px;
}
.choices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 20px;
}
label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
}
.field-error {
  margin-top: 8px;
}
</style>
