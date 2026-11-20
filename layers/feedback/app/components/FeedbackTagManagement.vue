<script setup lang="ts">
import type { FeedbackTag } from '../../shared/contracts'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ owner: string }>()
const tags = ref<FeedbackTag[]>([])
const ready = ref(false)
const allowed = ref(false)
const loading = ref(false)
const error = ref('')
const name = ref('')
const busy = ref(false)
const createWrite = useFeedbackWrite(`tags.create.${props.owner}`)
const pending = createWrite.pendingBody.value as { name?: unknown } | null
if (typeof pending?.name === 'string') name.value = pending.name
let active = true
onBeforeUnmount(() => {
  active = false
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const access = await $fetch<{ user: { id: string } | null; roles: string[] }>('/api/access')
    if (!active) return
    allowed.value = access.user?.id === props.owner && access.roles.includes('administrator')
    ready.value = true
    if (!allowed.value) {
      tags.value = []
      return
    }
    const data = await $fetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
    if (active) tags.value = data.tags
  } catch {
    if (active) error.value = 'Unable to load tag management. Please retry.'
  } finally {
    if (active) loading.value = false
  }
}
async function create() {
  if (busy.value) return
  const body = { name: name.value.trim() }
  if (!body.name || body.name.length > 40) {
    error.value = 'Enter a tag name between 1 and 40 characters.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/feedback/tags', {
      method: 'POST',
      body,
      headers: createWrite.headers(body),
      retry: 0,
    })
    if (!active) return
    createWrite.complete()
    name.value = ''
    await load()
  } catch (failure) {
    if (active)
      error.value =
        (failure as { statusCode?: number }).statusCode === 409
          ? 'A tag with that name already exists. Choose another name.'
          : feedbackWriteError(failure)
  } finally {
    if (active) busy.value = false
  }
}
onMounted(load)
</script>
<template>
  <p v-if="error" role="alert">
    {{ error }} <UiButton type="button" :busy="loading" @click="load">Reload tags</UiButton>
  </p>
  <p v-if="createWrite.warning.value" role="status">{{ createWrite.warning.value }}</p>
  <p v-if="loading" role="status">Loading tags…</p>
  <p v-if="ready && !allowed">Only administrators can manage tags.</p>
  <template v-if="allowed">
    <p class="help">
      Tags are optional labels for feedback. Disabling a tag prevents new selections and keeps it on
      existing posts.
    </p>
    <form class="create-tag" @submit.prevent="create">
      <div class="field">
        <label for="new-tag-name">New tag name</label
        ><input id="new-tag-name" v-model="name" maxlength="40" required :readonly="busy" />
      </div>
      <UiButton type="submit" :busy="busy" variant="primary">Create tag</UiButton>
    </form>
    <div class="tag-list">
      <FeedbackTagAdminRow
        v-for="tag in tags"
        :key="tag.id"
        :tag="tag"
        :owner="owner"
        @saved="load"
      />
    </div>
  </template>
</template>
<style scoped>
.help {
  color: var(--color-text-muted);
  max-width: 650px;
}
.create-tag {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
  margin: 24px 0;
}
.create-tag .field {
  flex: 1;
  max-width: 400px;
  min-width: 160px;
}
.tag-list {
  border-top: 1px solid var(--color-border);
}
</style>
