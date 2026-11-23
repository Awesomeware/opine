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
    <p class="tag-name">
      <span v-if="tag.icon" aria-hidden="true">{{ tag.icon }}</span>
      {{ tag.name }}
    </p>
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
      <div class="field">
        <label :for="`tag-${tag.id}-icon`">Tag icon (optional)</label>
        <input
          :id="`tag-${tag.id}-icon`"
          v-model="form.icon"
          maxlength="16"
          :aria-describedby="`tag-${tag.id}-icon-help${message ? ` tag-${tag.id}-message` : ''}`"
          :readonly="busy || refreshing || !!refreshError"
        />
        <p :id="`tag-${tag.id}-icon-help`" class="help">
          Use an emoji, or clear to remove the icon.
        </p>
      </div>
      <label class="available">
        <input
          v-model="form.isActive"
          type="checkbox"
          :disabled="busy || refreshing || !!refreshError"
        />
        Available for new selections
      </label>
      <Button type="submit" :busy="busy" :disabled="conflict || refreshing || !!refreshError">
        Save tag
      </Button>
    </form>
    <p v-if="message" :id="`tag-${tag.id}-message`" role="status">{{ message }}</p>
    <p v-if="refreshError" role="alert">
      {{ refreshError }}
      <Button :busy="refreshing" @click="loadLatest">Retry latest tag</Button>
    </p>
    <div v-if="conflict">
      <Button type="button" :busy="refreshing" @click="loadLatest">Load latest tag</Button>
      <div v-if="latest">
        <p>
          Latest:
          <span v-if="latest.icon" aria-hidden="true">{{ latest.icon }}</span>
          {{ latest.name }} — {{ latest.isActive ? 'Available' : 'Inactive' }}
        </p>
        <p v-if="!latest.icon">No icon.</p>
        <Button type="button" :disabled="refreshing" @click="acceptConflict">
          I’ve reviewed the latest tag
        </Button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.tag-row {
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}
.tag-name {
  margin: 0 0 12px;
}
.help {
  color: var(--color-text-muted);
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
