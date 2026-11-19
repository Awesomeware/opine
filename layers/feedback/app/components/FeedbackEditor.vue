<script setup lang="ts">
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
import { authClient } from '../../../auth/app/auth-client'
import { validatePostEditInput, validateCommentEditInput } from '../../shared/participation-input'
import { postLimits } from '../../shared/post-input'
const props = defineProps<{
  owner: string
  endpoint: string
  version: number
  body?: string
  title?: string
  description?: string
  desiredImprovement?: string | null
}>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const isPost = props.body === undefined
const draftKey = `opine.feedback.edit.${props.owner}.${props.endpoint}`
const form = reactive({
  title: props.title ?? '',
  description: props.description ?? '',
  desiredImprovement: props.desiredImprovement ?? '',
  body: props.body ?? '',
  version: props.version,
})
const write = useFeedbackWrite(`edit.${props.owner}.${props.endpoint}`)
const busy = ref(false)
const message = ref('')
const fieldErrors = ref<Record<string, string>>({})
const expired = ref(false)
const route = useRoute()
async function signIn() {
  try {
    const result = await authClient.signIn.social({
      provider: 'discord',
      callbackURL: route.fullPath,
    })
    if (result.error) message.value = 'Unable to start sign-in. Please try again.'
  } catch {
    message.value = 'Unable to start sign-in. Please try again.'
  }
}
const conflict = ref(false)
const latest = ref<typeof form | null>(null)
let active = true
onBeforeUnmount(() => {
  active = false
})
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
  if (saved && typeof saved.version === 'number') {
    for (const key of ['title', 'description', 'desiredImprovement', 'body'] as const)
      if (typeof saved[key] === 'string') form[key] = saved[key]
    form.version = saved.version
  }
} catch {
  message.value = 'The saved edit could not be restored.'
}
watch(
  form,
  () => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(form))
    } catch {
      message.value = 'Your edit cannot be saved in this browser. Keep this form open.'
    }
  },
  { flush: 'sync' },
)
async function save() {
  if (busy.value || conflict.value) return
  message.value = ''
  fieldErrors.value = {}
  const input = isPost
    ? {
        title: form.title,
        description: form.description,
        desiredImprovement: form.desiredImprovement || null,
        version: form.version,
      }
    : { body: form.body, version: form.version }
  const parsed = isPost ? validatePostEditInput(input) : validateCommentEditInput(input)
  if (!parsed.success) {
    fieldErrors.value = parsed.fieldErrors
    message.value = 'Please check the highlighted fields.'
    return
  }
  const body = parsed.data
  busy.value = true
  try {
    await $fetch(props.endpoint, { method: 'PATCH', body, headers: write.headers(body), retry: 0 })
    if (!active) return
    write.complete()
    try {
      sessionStorage.removeItem(draftKey)
    } catch {
      /* Saved successfully. */
    }
    emit('saved')
  } catch (error) {
    if (!active) return
    if ((error as { statusCode?: number }).statusCode === 409) {
      conflict.value = true
      message.value =
        'This content changed while you were editing. Your text is preserved. Load the latest version to review it before saving again.'
    } else {
      message.value = feedbackWriteError(error)
      expired.value = (error as { statusCode?: number }).statusCode === 401
    }
  } finally {
    busy.value = false
  }
}
async function loadLatest() {
  busy.value = true
  try {
    const response = await $fetch<{ post?: typeof form; comment?: typeof form }>(props.endpoint)
    if (!active) return
    latest.value = response.post ?? response.comment ?? null
  } catch {
    if (active) message.value = 'Unable to load the latest version. Please retry.'
  } finally {
    busy.value = false
  }
}
function acceptLatest() {
  if (!latest.value) return
  form.version = latest.value.version
  conflict.value = false
  latest.value = null
  message.value =
    'Latest version reviewed. Your text is still in the form; review it and save when ready.'
}
</script>
<template>
  <form class="panel feedback-form" novalidate @submit.prevent="save">
    <button v-if="expired" type="button" @click="signIn">Sign in again</button>
    <p v-if="message" role="alert">{{ message }}</p>
    <p v-if="write.warning.value">{{ write.warning.value }}</p>
    <template v-if="isPost"
      ><div class="field">
        <label :for="`${endpoint}-title`">Title</label
        ><input
          :readonly="busy"
          :id="`${endpoint}-title`"
          v-model="form.title"
          :aria-invalid="!!fieldErrors.title"
          :aria-describedby="fieldErrors.title ? `${endpoint}-title-error` : undefined"
          required
          :maxlength="postLimits.title"
        />
      </div>
      <div class="field">
        <label :for="`${endpoint}-description`">Feedback</label
        ><textarea
          :readonly="busy"
          :id="`${endpoint}-description`"
          v-model="form.description"
          :aria-invalid="!!fieldErrors.description"
          :aria-describedby="fieldErrors.description ? `${endpoint}-description-error` : undefined"
          required
          rows="6"
          :maxlength="postLimits.description"
        />
      </div>
      <div class="field">
        <label :for="`${endpoint}-improvement`">Suggested improvement (optional)</label
        ><textarea
          :readonly="busy"
          :id="`${endpoint}-improvement`"
          v-model="form.desiredImprovement"
          :aria-invalid="!!fieldErrors.desiredImprovement"
          :aria-describedby="
            fieldErrors.desiredImprovement ? `${endpoint}-desiredImprovement-error` : undefined
          "
          rows="3"
          :maxlength="postLimits.desiredImprovement"
        /></div
    ></template>
    <div v-else class="field">
      <label :for="`${endpoint}-body`">Edit comment</label
      ><textarea
        :readonly="busy"
        :id="`${endpoint}-body`"
        v-model="form.body"
        :aria-invalid="!!fieldErrors.body"
        :aria-describedby="fieldErrors.body ? `${endpoint}-body-error` : undefined"
        required
        rows="4"
        maxlength="10000"
      />
    </div>
    <p
      v-for="(error, field) in fieldErrors"
      :id="`${endpoint}-${field}-error`"
      :key="field"
      class="field-error"
    >
      {{ error }}
    </p>
    <div v-if="conflict">
      <button type="button" :disabled="busy" @click="loadLatest">Load latest version</button>
      <div v-if="latest" class="latest">
        <h3>Latest saved content</h3>
        <template v-if="isPost"
          ><strong>{{ latest.title }}</strong
          ><FeedbackText :text="latest.description" /><FeedbackText
            v-if="latest.desiredImprovement"
            :text="latest.desiredImprovement" /></template
        ><FeedbackText v-else :text="latest.body" /><button type="button" @click="acceptLatest">
          I’ve reviewed the latest version
        </button>
      </div>
    </div>
    <div class="form-actions">
      <button type="submit" :disabled="busy || conflict">
        {{ busy ? 'Saving…' : 'Save changes' }}</button
      ><button type="button" :disabled="busy" @click="emit('cancel')">Cancel edit</button>
    </div>
  </form>
</template>
<style scoped>
.latest {
  border-left: 3px solid currentColor;
  padding: 1rem;
  margin-top: 1rem;
}
</style>
