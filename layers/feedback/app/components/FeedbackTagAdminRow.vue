<script setup lang="ts">
import type { FeedbackTag } from '../../shared/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ tag: FeedbackTag; owner: string }>()
const emit = defineEmits<{ saved: [] }>()
const write = useFeedbackWrite(`tags.edit.${props.owner}.${props.tag.id}`)
const form = reactive({
  name: props.tag.name,
  isActive: props.tag.isActive,
  version: props.tag.version,
})
const pending = write.pendingBody.value as typeof form | null
if (
  pending &&
  typeof pending.name === 'string' &&
  typeof pending.isActive === 'boolean' &&
  typeof pending.version === 'number'
)
  Object.assign(form, pending)
const busy = ref(false)
const message = ref('')
const conflict = ref(false)
const latest = ref<FeedbackTag | null>(null)
let active = true
onBeforeUnmount(() => {
  active = false
})
async function save() {
  if (busy.value || conflict.value) return
  const body = { ...form, name: form.name.trim() }
  if (!body.name || body.name.length > 40) {
    message.value = 'Enter a tag name between 1 and 40 characters.'
    return
  }
  busy.value = true
  message.value = ''
  try {
    await $fetch(`/api/feedback/tags/${props.tag.id}`, {
      method: 'PATCH',
      body,
      headers: write.headers(body),
      retry: 0,
    })
    if (!active) return
    // Fetch canonical state before allowing another edit, including receipt replays.
    const data = await $fetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
    if (!active) return
    const saved = data.tags.find((tag) => tag.id === props.tag.id)
    if (saved)
      Object.assign(form, { name: saved.name, isActive: saved.isActive, version: saved.version })
    write.complete()
    message.value = 'Tag saved.'
    emit('saved')
  } catch (failure) {
    if (!active) return
    if ((failure as { statusCode?: number }).statusCode === 409) {
      conflict.value = true
      message.value =
        'This tag changed or its name is already in use. Load the latest version and review it before saving again.'
    } else message.value = feedbackWriteError(failure)
  } finally {
    if (active) busy.value = false
  }
}
async function loadLatest() {
  busy.value = true
  try {
    const data = await $fetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
    if (active) latest.value = data.tags.find((tag) => tag.id === props.tag.id) ?? null
  } catch {
    if (active) message.value = 'Unable to load the latest tag. Please retry.'
  } finally {
    if (active) busy.value = false
  }
}
function reviewed() {
  if (!latest.value) return
  form.version = latest.value.version
  latest.value = null
  conflict.value = false
  message.value = 'Latest version reviewed. Your changes remain in the form.'
}
</script>
<template>
  <section :aria-label="`${tag.name} tag`" class="tag-row">
    <form @submit.prevent="save">
      <div class="field">
        <label :for="`tag-${tag.id}`">Tag name</label
        ><input
          :id="`tag-${tag.id}`"
          v-model="form.name"
          maxlength="40"
          required
          :readonly="busy"
        />
      </div>
      <label class="available"
        ><input v-model="form.isActive" type="checkbox" :disabled="busy" />Available for new
        selections</label
      >
      <UiButton type="submit" :busy="busy" :disabled="conflict">Save tag</UiButton>
    </form>
    <p v-if="write.warning.value" role="status">{{ write.warning.value }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <div v-if="conflict">
      <UiButton type="button" :busy="busy" @click="loadLatest">Load latest tag</UiButton>
      <div v-if="latest">
        <p>Latest: {{ latest.name }} — {{ latest.isActive ? 'Available' : 'Inactive' }}</p>
        <UiButton type="button" @click="reviewed">I’ve reviewed the latest tag</UiButton>
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
.available input {
  width: 16px;
  height: 16px;
  min-height: 0;
  padding: 0;
  accent-color: var(--color-accent);
}
p {
  margin: 12px 0 0;
  font-size: 0.85rem;
}
</style>
