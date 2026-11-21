<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import UiNotice from '../../../../ui/app/components/UiNotice.vue'
import UiButton from '../../../../ui/app/components/UiButton.vue'
import FeedbackText from '../../components/FeedbackText.vue'
import FeedbackContributionType from './FeedbackContributionType.vue'
import { useCommentEditor } from '../composables/useCommentEditor'
import type { FeedbackComment } from '../../../shared/discussion/contracts'
import { contributionLabels } from '../../../shared/discussion/contribution-types'

const props = defineProps<{ owner: string; comment: FeedbackComment }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const editor = useCommentEditor(props.comment)
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
} = editor

const bodyInput = ref<HTMLTextAreaElement | null>(null)
const errorSummary = ref<InstanceType<typeof UiNotice> | null>(null)

onMounted(() => bodyInput.value?.focus())

async function reviewLatest() {
  acceptLatest()
  await nextTick()
  bodyInput.value?.focus()
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
    <FeedbackContributionType
      v-model="form.type"
      :name="`${endpoint}-type`"
      :disabled="busy"
      :legacy="!comment.type"
      :error="fieldErrors.type"
    />
    <div class="field">
      <label :for="`${endpoint}-body`">Edit comment</label>
      <textarea
        ref="bodyInput"
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
    <p v-if="fieldErrors.body" :id="`${endpoint}-body-error`" class="field-error">
      {{ fieldErrors.body }}
    </p>
    <p v-if="fieldErrors.form" class="field-error">{{ fieldErrors.form }}</p>
    <p v-if="latestError" role="alert">{{ latestError }}</p>
    <div v-if="conflict">
      <UiButton type="button" :busy="loadingLatest" @click="loadLatest">
        Load latest version
      </UiButton>
      <div v-if="latest" class="latest">
        <h3>Latest saved content</h3>
        <p>{{ latest.type ? contributionLabels[latest.type] : 'Unspecified' }}</p>
        <FeedbackText :text="latest.body" />
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
