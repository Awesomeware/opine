<script setup lang="ts">
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
import { authClient } from '../../../auth/app/auth-client'
import { validatePostEditInput, validateCommentEditInput } from '../../shared/participation-input'
import {
  contributionLabels,
  isContributionType,
  type ContributionType,
} from '../../shared/contribution-types'
import type { FeedbackTag } from '../../shared/contracts'
import { postLimits } from '../../shared/post-input'
const props = defineProps<{
  owner: string
  endpoint: string
  version: number
  type?: ContributionType | null
  body?: string
  title?: string
  description?: string
  desiredImprovement?: string | null
  tags?: FeedbackTag[]
}>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const isPost = props.body === undefined
const draftKey = `opine.feedback.edit.${props.owner}.${props.endpoint}`
const form = reactive({
  title: props.title ?? '',
  description: props.description ?? '',
  desiredImprovement: props.desiredImprovement ?? '',
  body: props.body ?? '',
  type: (props.type ?? '') as ContributionType | '',
  version: props.version,
  tagIds: props.tags?.map((tag) => tag.id) ?? [],
})
const baselineTags = ref(props.tags ?? [])
const {
  data: tagData,
  pending: tagsPending,
  error: tagsError,
  refresh: refreshTags,
} = useFetch<{ tags: FeedbackTag[] }>('/api/feedback/tags', { immediate: isPost })
const availableTags = computed(() => {
  const tags = [...(tagData.value?.tags ?? [])]
  for (const tag of baselineTags.value)
    if (!tags.some((value) => value.id === tag.id)) tags.push(tag)
  return tags
})
const baselineType = ref<ContributionType | ''>(props.type ?? '')
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
const latest = ref<(typeof form & { tags?: FeedbackTag[] }) | null>(null)
let active = true
onBeforeUnmount(() => {
  active = false
})
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
  if (saved && typeof saved.version === 'number') {
    for (const key of ['title', 'description', 'desiredImprovement', 'body'] as const)
      if (typeof saved[key] === 'string') form[key] = saved[key]
    if (Array.isArray(saved.tagIds) && saved.tagIds.every((id: unknown) => typeof id === 'string'))
      form.tagIds = saved.tagIds
    if (isContributionType(saved.type)) form.type = saved.type
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
  const pending = write.pendingBody.value as { type?: ContributionType; tagIds?: string[] } | null
  const includeType = form.type && (form.type !== baselineType.value || pending?.type === form.type)
  const tagsChanged =
    JSON.stringify([...form.tagIds].sort()) !==
    JSON.stringify(baselineTags.value.map((tag) => tag.id).sort())
  const input = isPost
    ? {
        title: form.title,
        description: form.description,
        desiredImprovement: form.desiredImprovement || null,
        version: form.version,
        ...(tagsChanged || pending?.tagIds ? { tagIds: form.tagIds } : {}),
      }
    : {
        body: form.body,
        version: form.version,
        ...(includeType ? { type: form.type } : {}),
      }
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
      const errors = (error as { data?: { data?: { fieldErrors?: Record<string, string> } } }).data
        ?.data?.fieldErrors
      if (errors) fieldErrors.value = errors
      if (isPost && (error as { statusCode?: number }).statusCode === 400) {
        await refreshTags()
        if (!errors)
          fieldErrors.value.tagIds =
            'Check your selected tags. Unavailable tags can only be kept on posts that already have them, or removed.'
      }
      message.value = Object.keys(fieldErrors.value).length
        ? 'Please check the highlighted fields.'
        : feedbackWriteError(error)
      expired.value = (error as { statusCode?: number }).statusCode === 401
    }
  } finally {
    busy.value = false
  }
}
async function loadLatest() {
  busy.value = true
  try {
    const response = await $fetch<{
      post?: typeof form & { tags?: FeedbackTag[] }
      comment?: typeof form
    }>(props.endpoint)
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
  baselineType.value = latest.value.type ?? ''
  if (isPost) baselineTags.value = latest.value.tags ?? []
  form.version = latest.value.version
  conflict.value = false
  latest.value = null
  message.value =
    'Latest version reviewed. Your text is still in the form; review it and save when ready.'
}
</script>
<template>
  <form class="panel feedback-form" novalidate @submit.prevent="save">
    <UiButton v-if="expired" type="button" @click="signIn">Sign in again</UiButton>
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
        />
      </div>
      <div>
        <p v-if="tagsPending" role="status">Loading tags…</p>
        <p v-else-if="tagsError" role="alert">
          Unable to load tags. Existing selections are preserved.
          <UiButton type="button" @click="refreshTags()">Retry tags</UiButton>
          <UiButton
            v-if="form.tagIds.length"
            type="button"
            :disabled="busy"
            @click="form.tagIds = []"
            >Clear selected tags</UiButton
          >
        </p>
        <FeedbackTagPicker
          v-else
          v-model="form.tagIds"
          :tags="availableTags"
          :retained-ids="baselineTags.map((tag) => tag.id)"
          :name="`${endpoint}-tags`"
          :disabled="busy"
          :error="fieldErrors.tagIds"
        />
      </div>
    </template>
    <template v-else>
      <FeedbackContributionType
        v-model="form.type"
        :name="`${endpoint}-type`"
        :disabled="busy"
        :legacy="!props.type"
        :error="fieldErrors.type"
      />
      <div class="field">
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
    </template>
    <p
      v-for="(error, field) in fieldErrors"
      :id="`${endpoint}-${field}-error`"
      :key="field"
      class="field-error"
    >
      {{ error }}
    </p>
    <div v-if="conflict">
      <UiButton type="button" :busy="busy" @click="loadLatest">Load latest version</UiButton>
      <div v-if="latest" class="latest">
        <h3>Latest saved content</h3>
        <template v-if="isPost"
          ><strong>{{ latest.title }}</strong
          ><FeedbackText :text="latest.description" /><FeedbackText
            v-if="latest.desiredImprovement"
            :text="latest.desiredImprovement"
          />
          <p>Latest tags</p>
          <FeedbackTags :tags="latest.tags ?? []" />
          <p v-if="!latest.tags?.length">No tags</p></template
        ><template v-else
          ><p>{{ latest.type ? contributionLabels[latest.type] : 'Unspecified' }}</p>
          <FeedbackText :text="latest.body" /></template
        ><UiButton type="button" @click="acceptLatest">I’ve reviewed the latest version</UiButton>
      </div>
    </div>
    <div class="form-actions">
      <UiButton type="submit" :busy="busy" :disabled="busy || conflict">
        {{ busy ? 'Saving…' : 'Save changes' }}</UiButton
      ><UiButton type="button" :busy="busy" @click="emit('cancel')">Cancel edit</UiButton>
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
