<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import Notice from '../../../../ui/app/components/Notice.vue'
import Button from '../../../../ui/app/components/Button.vue'
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
const errorSummary = ref<InstanceType<typeof Notice> | null>(null)

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
    <Button v-if="expired" type="button" @click="signIn">Sign in again</Button>
    <Notice v-if="message" ref="errorSummary" role="alert" tabindex="-1">{{ message }}</Notice>
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
      <Button type="button" :busy="loadingLatest" @click="loadLatest">Load latest version</Button>
      <div v-if="latest" class="latest">
        <h3>Latest saved content</h3>
        <p>{{ latest.type ? contributionLabels[latest.type] : 'Unspecified' }}</p>
        <FeedbackText :text="latest.body" />
        <Button type="button" @click="reviewLatest">I’ve reviewed the latest version</Button>
      </div>
    </div>
    <div class="form-actions">
      <Button type="submit" :busy="busy" :disabled="busy || conflict">
        {{ saving ? 'Saving…' : 'Save changes' }}
      </Button>
      <Button type="button" :busy="busy" @click="emit('cancel')">Cancel edit</Button>
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
