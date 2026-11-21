<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useFeedbackTagEditor } from '../composables/useFeedbackTagEditor'
import type { FeedbackTag } from '../../../shared/posts/contracts'

const props = defineProps<{ tag: FeedbackTag; owner: string }>()
const emit = defineEmits<{ saved: [] }>()

const {
  form,
  busy,
  message,
  refreshError,
  refreshing,
  conflict,
  latest,
  save,
  loadLatest,
  reviewed,
} = useFeedbackTagEditor(props, () => emit('saved'))

const nameInput = ref<HTMLInputElement | null>(null)

async function acceptConflict() {
  reviewed()
  await nextTick()
  nameInput.value?.focus()
}
</script>
<template>
  <section :aria-label="`${tag.name} tag`" class="tag-row">
    <form @submit.prevent="save">
      <div class="field">
        <label :for="`tag-${tag.id}`">Tag name</label>
        <input
          :id="`tag-${tag.id}`"
          ref="nameInput"
          :aria-describedby="message ? `tag-${tag.id}-message` : undefined"
          v-model="form.name"
          maxlength="40"
          required
          :readonly="busy || refreshing || !!refreshError"
        />
      </div>
      <label class="available">
        <input
          v-model="form.isActive"
          type="checkbox"
          :disabled="busy || refreshing || !!refreshError"
        />
        Available for new selections
      </label>
      <UiButton type="submit" :busy="busy" :disabled="conflict || refreshing || !!refreshError">
        Save tag
      </UiButton>
    </form>
    <p v-if="message" :id="`tag-${tag.id}-message`" role="status">{{ message }}</p>
    <p v-if="refreshError" role="alert">
      {{ refreshError }}
      <UiButton :busy="refreshing" @click="loadLatest">Retry latest tag</UiButton>
    </p>
    <div v-if="conflict">
      <UiButton type="button" :busy="refreshing" @click="loadLatest">Load latest tag</UiButton>
      <div v-if="latest">
        <p>Latest: {{ latest.name }} — {{ latest.isActive ? 'Available' : 'Inactive' }}</p>
        <UiButton type="button" :disabled="refreshing" @click="acceptConflict">
          I’ve reviewed the latest tag
        </UiButton>
      </div>
    </div>
  </section>
</template>
<style scoped>
.tag-row {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}
form {
  display: flex;
  gap: 16px;
  align-items: end;
  flex-wrap: wrap;
}
.field {
  flex: 1;
  min-width: 160px;
  max-width: 400px;
}
.available {
  display: flex;
  gap: 7px;
  align-items: center;
  min-height: 38px;
  font-size: 0.85rem;
}
p {
  margin: 12px 0 0;
  font-size: 0.85rem;
}
</style>
