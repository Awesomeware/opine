<script setup lang="ts">
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

async function save() {
  if (await editor.save()) {
    emit('saved')
  }
}
</script>
<template>
  <form class="panel feedback-form" novalidate @submit.prevent="save">
    <UiButton v-if="expired" type="button" @click="signIn">Sign in again</UiButton>
    <p v-if="message" role="alert">{{ message }}</p>
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
        <UiButton type="button" @click="acceptLatest">I’ve reviewed the latest version</UiButton>
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
