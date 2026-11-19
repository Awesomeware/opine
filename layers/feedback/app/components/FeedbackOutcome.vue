<script setup lang="ts">
import type { FeedbackOutcome } from '../../shared/contracts'
import { statusLabels, postStatuses, isPostStatus, type PostStatus } from '../../shared/status'
import { validateOfficialResponseInput } from '../../shared/outcome-input'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ postId: string; owner: string | null; categoryId: string }>()
const emit = defineEmits<{ published: [] }>()
const endpoint = `/api/feedback/posts/${props.postId}`
const outcome = ref<FeedbackOutcome | null>(null)
const error = ref('')
const busy = ref(false)
const message = ref('')
const bodyError = ref('')
const conflict = ref(false)
const latest = ref<FeedbackOutcome | null>(null)
const form = reactive({ body: '', status: '' as PostStatus | '', version: 0 })
const draftKey = `opine.feedback.response.${props.owner}.${props.postId}`
const write = useFeedbackWrite(`response.${props.owner}.${props.postId}`)
const followWrite = useFeedbackWrite(`follow.${props.owner}.${props.postId}`)
let active = true
let initialized = false
onBeforeUnmount(() => {
  active = false
})
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
  if (props.owner && saved && typeof saved.body === 'string' && Number.isInteger(saved.version)) {
    form.body = saved.body
    form.status = isPostStatus(saved.status) ? saved.status : ''
    form.version = saved.version
    initialized = true
  }
} catch {
  message.value = 'Your response draft could not be restored.'
}
watch(
  form,
  () => {
    if (!props.owner) return
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(form))
    } catch {
      message.value = 'Your draft cannot be saved in this browser. Keep this page open.'
    }
  },
  { flush: 'sync' },
)
async function load() {
  try {
    const result = await $fetch<FeedbackOutcome>(`${endpoint}/outcome`)
    if (!active) return
    outcome.value = result
    error.value = ''
    if (!initialized) {
      form.version = result.version
      initialized = true
    }
  } catch {
    if (active) error.value = 'Unable to load the team response and follow state.'
  }
}
async function follow(payload: { following: boolean }) {
  if (busy.value || !props.owner) return
  busy.value = true
  message.value = ''
  try {
    await $fetch(`${endpoint}/follow`, {
      method: 'PUT',
      body: payload,
      headers: followWrite.headers(payload),
      retry: 0,
    })
    if (!active) return
    followWrite.complete()
    await load()
  } catch (failure) {
    if (active) message.value = feedbackWriteError(failure)
  } finally {
    busy.value = false
  }
}
function retryFollow() {
  const payload = followWrite.pendingBody.value as { following: boolean } | null
  if (payload) void follow(payload)
}
async function publish(retry = false) {
  if (busy.value || conflict.value || !props.owner) return
  const payload = retry
    ? (write.pendingBody.value as { body: string; status?: PostStatus; version: number })
    : {
        body: form.body.trim(),
        ...(form.status ? { status: form.status } : {}),
        version: form.version,
      }
  bodyError.value = ''
  const parsed = validateOfficialResponseInput(payload)
  if (!parsed.success) {
    bodyError.value = parsed.fieldErrors.body ?? ''
    message.value = 'Please check the highlighted fields.'
    return
  }
  busy.value = true
  message.value = ''
  try {
    const result = await $fetch<{ id: string }>(`${endpoint}/responses`, {
      method: 'POST',
      body: payload,
      headers: write.headers(payload),
      retry: 0,
    })
    if (!active) return
    write.complete()
    form.body = ''
    form.status = ''
    initialized = false
    await load()
    if (!active) return
    try {
      sessionStorage.removeItem(draftKey)
    } catch {
      /* Published. */
    }
    emit('published')
    await navigateTo({
      path: `/feedback/${props.postId}`,
      query: { response: result.id },
      hash: `#response-${result.id}`,
    })
  } catch (failure) {
    if (!active) return
    if ((failure as { statusCode?: number }).statusCode === 409) {
      conflict.value = true
      message.value =
        'The team workflow changed. Your draft is preserved. Review the latest outcome before publishing.'
    } else {
      if ((failure as { statusCode?: number }).statusCode === 400) write.complete()
      message.value = feedbackWriteError(failure)
    }
  } finally {
    busy.value = false
  }
}
async function loadLatest() {
  busy.value = true
  try {
    const result = await $fetch<FeedbackOutcome>(`${endpoint}/outcome`)
    if (active) latest.value = result
  } catch {
    if (active) message.value = 'Unable to load the latest outcome. Please retry.'
  } finally {
    busy.value = false
  }
}
function acceptLatest() {
  if (!latest.value) return
  outcome.value = latest.value
  form.version = latest.value.version
  latest.value = null
  conflict.value = false
  write.complete()
  message.value = 'Latest outcome reviewed. Review your preserved draft before publishing.'
}
onMounted(load)
</script>
<template>
  <section aria-label="Team response and status" class="outcome">
    <p v-if="error" role="alert">
      {{ error }} <button type="button" @click="load">Retry outcome</button>
    </p>
    <template v-if="outcome">
      <h2>Team response and status</h2>
      <p><strong class="status-badge">{{ statusLabels[outcome.status] }}</strong></p>
      <p v-if="outcome.status === 'new'">
        Awaiting initial review. New does not mean the team has acknowledged this feedback.
      </p>
      <NuxtLink
        v-if="outcome.statusResponse"
        :to="{
          path: `/feedback/${postId}`,
          query: { response: outcome.statusResponse.id },
          hash: `#response-${outcome.statusResponse.id}`,
        }"
        >Why this status?</NuxtLink
      >
      <FeedbackOfficialResponse
        v-if="outcome.latestResponse"
        :response="outcome.latestResponse"
        featured
      />
      <p v-else>No official response yet.</p>
      <button
        v-if="owner"
        class="button-primary"
        type="button"
        :disabled="busy || !!followWrite.pendingBody.value"
        @click="follow({ following: !outcome.following })"
      >
        {{ outcome.following ? 'Unfollow updates' : 'Follow updates' }}
      </button>
      <p class="field-help">
        Follow to receive notifications when the team publishes an official response.
      </p>
      <button
        v-if="followWrite.pendingBody.value"
        type="button"
        :disabled="busy"
        @click="retryFollow"
      >
        Retry pending follow change
      </button>
      <p v-if="message" role="alert">{{ message }}</p>
      <p v-if="followWrite.warning.value">{{ followWrite.warning.value }}</p>
      <FeedbackCategoryCorrection
        v-if="owner && outcome.canRespond"
        :owner="owner"
        :post-id="postId"
        :category-id="categoryId"
        :version="outcome.version"
        @saved="
          load();
          emit('published')
        "
      />
      <form
        v-if="owner && outcome.canRespond"
        class="panel feedback-form"
        aria-label="Publish official response"
        novalidate
        @submit.prevent="publish()"
      >
        <h3>Publish an official response</h3>
        <p>This is a public team response. Corrections require a new response.</p>
        <div class="field">
          <label for="official-response-body">Official response</label
          ><textarea
            id="official-response-body"
            :aria-invalid="!!bodyError"
            :aria-describedby="bodyError ? 'official-response-error' : undefined"
            v-model="form.body"
            :readonly="busy || !!write.pendingBody.value"
            rows="5"
            maxlength="10000"
            required
          />
        </div>
        <p v-if="bodyError" id="official-response-error" class="field-error" role="alert">
          {{ bodyError }}
        </p>
        <div class="field">
          <label for="official-response-status">Status change</label
          ><select
            id="official-response-status"
            v-model="form.status"
            :disabled="busy || !!write.pendingBody.value"
          >
            <option value="">Keep current status</option>
            <option v-for="status in postStatuses" :key="status" :value="status">
              {{ statusLabels[status] }}
            </option>
          </select>
        </div>
        <p v-if="write.warning.value">{{ write.warning.value }}</p>
        <div v-if="conflict">
          <button type="button" :disabled="busy" @click="loadLatest">Load latest outcome</button>
          <div v-if="latest">
            <p>Current status: {{ statusLabels[latest.status] }}</p>
            <FeedbackOfficialResponse
              v-if="latest.latestResponse"
              :response="latest.latestResponse"
              featured
            /><button type="button" @click="acceptLatest">I’ve reviewed the latest outcome</button>
          </div>
        </div>
        <button
          v-if="write.pendingBody.value && !conflict"
          type="button"
          :disabled="busy"
          @click="publish(true)"
        >
          Retry pending official response
        </button>
        <button type="submit" :disabled="busy || conflict || !!write.pendingBody.value">
          {{ busy ? 'Publishing…' : 'Publish official response' }}
        </button>
      </form>
    </template>
  </section>
</template>
<style scoped>
.outcome {
  margin: 2rem 0;
  padding-top: 1rem;
  border-top: 1px solid var(--border, #ddd);
}
.feedback-form {
  margin-top: 1.5rem;
}
</style>
