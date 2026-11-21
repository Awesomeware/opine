<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import UiNotice from '../../../../ui/app/components/UiNotice.vue'
import UiButton from '../../../../ui/app/components/UiButton.vue'
import FeedbackText from '../../components/FeedbackText.vue'
import FeedbackTags from './FeedbackTags.vue'
import FeedbackTagPicker from './FeedbackTagPicker.vue'
import { usePostEditor } from '../composables/usePostEditor'
import type { FeedbackPost } from '../../../shared/posts/contracts'
import { postLimits } from '../../../shared/posts/input'

const props = defineProps<{ owner: string; post: FeedbackPost }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const editor = usePostEditor(props.owner, props.post)
const {
  endpoint,
  form,
  busy,
  saving,
  loadingLatest,
  message,
  latestError,
  fieldErrors,
  expired,
  conflict,
  latest,
  signIn,
  loadLatest,
  acceptLatest,
  baselineTags,
  availableTags,
  tagsPending,
  tagsError,
  refreshTags,
  clearTags,
} = editor

const titleInput = ref<HTMLInputElement | null>(null)
const errorSummary = ref<InstanceType<typeof UiNotice> | null>(null)

onMounted(() => titleInput.value?.focus())

async function reviewLatest() {
  acceptLatest()
  await nextTick()
  titleInput.value?.focus()
}

async function save() {
  if (await editor.save()) {
    emit('saved')
  } else if (message.value) {
    await nextTick()
    errorSummary.value?.focus()
  }
}
</script>
<template>
  <form class="panel feedback-form" novalidate @submit.prevent="save">
    <UiButton v-if="expired" type="button" @click="signIn">Sign in again</UiButton>
    <UiNotice v-if="message" ref="errorSummary" role="alert" tabindex="-1">{{ message }}</UiNotice>
    <div class="field">
      <label :for="`${endpoint}-title`">Title</label>
      <input
        ref="titleInput"
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
      <label :for="`${endpoint}-description`">Feedback</label>
      <textarea
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
      <label :for="`${endpoint}-improvement`">Suggested improvement (optional)</label>
      <textarea
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
        <UiButton v-if="form.tagIds.length" type="button" :disabled="busy" @click="clearTags">
          Clear selected tags
        </UiButton>
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
      <p v-if="(tagsPending || tagsError) && fieldErrors.tagIds" class="field-error">
        {{ fieldErrors.tagIds }}
      </p>
    </div>
    <p
      v-for="field in ['title', 'description', 'desiredImprovement', 'form']"
      :id="`${endpoint}-${field}-error`"
      :key="field"
      v-show="fieldErrors[field]"
      class="field-error"
    >
      {{ fieldErrors[field] }}
    </p>
    <p v-if="latestError" role="alert">{{ latestError }}</p>
    <div v-if="conflict">
      <UiButton type="button" :busy="loadingLatest" @click="loadLatest">
        Load latest version
      </UiButton>
      <div v-if="latest" class="latest">
        <h3>Latest saved content</h3>
        <strong>{{ latest.title }}</strong>
        <FeedbackText :text="latest.description" />
        <FeedbackText v-if="latest.desiredImprovement" :text="latest.desiredImprovement" />
        <p>Latest tags</p>
        <FeedbackTags :tags="latest.tags ?? []" />
        <p v-if="!latest.tags?.length">No tags</p>
        <UiButton type="button" @click="reviewLatest">I’ve reviewed the latest version</UiButton>
      </div>
    </div>
    <div class="form-actions">
      <UiButton type="submit" :busy="busy" :disabled="busy || conflict">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </UiButton>
      <UiButton type="button" :busy="busy" @click="emit('cancel')">Cancel edit</UiButton>
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
