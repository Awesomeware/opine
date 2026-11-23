<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Notice from '../../../../ui/app/components/Notice.vue'
import { useCommentComposer } from '../composables/useCommentComposer'

const props = defineProps<{ postId: string; owner: string | null; refresh: () => Promise<void> }>()
const { body, type, busy, message, fieldErrors, expired, signIn, submitComment } =
  useCommentComposer(props, props.refresh)
const commentInput = ref<HTMLTextAreaElement | null>(null)

const errorSummary = ref<InstanceType<typeof Notice> | null>(null)

async function submit() {
  await submitComment()
  if (message.value) {
    await nextTick()
    errorSummary.value?.focus()
  }
}

function focus() {
  commentInput.value?.focus()
}

defineExpose({ focus })
</script>
<template>
  <Button v-if="expired" type="button" @click="signIn">Sign in again</Button>
  <Notice v-if="message" ref="errorSummary" role="alert" tabindex="-1">{{ message }}</Notice>
  <form v-if="owner" class="comment-form" novalidate @submit.prevent="submit">
    <h3>Add a contribution</h3>
    <FeedbackContributionType
      v-model="type"
      name="new-contribution-type"
      :disabled="busy"
      :error="fieldErrors.type"
    />
    <div class="field">
      <label for="new-comment">Add a comment</label>
      <textarea
        :readonly="busy"
        id="new-comment"
        ref="commentInput"
        v-model="body"
        :aria-invalid="!!fieldErrors.body"
        :aria-describedby="fieldErrors.body ? 'comment-error' : undefined"
        required
        maxlength="10000"
        rows="4"
      />
    </div>
    <p v-if="fieldErrors.body" id="comment-error" class="field-error">{{ fieldErrors.body }}</p>
    <p class="field-help">
      Your comment and display name will be public. Read the
      <NuxtLink
        to="/rules"
        target="_blank"
        rel="noopener"
        aria-label="community rules (opens in a new tab)"
      >
        community rules
      </NuxtLink>
      before contributing.
    </p>
    <Button variant="primary" type="submit" :busy="busy" :disabled="busy">
      {{ busy ? 'Submitting…' : 'Submit comment' }}
    </Button>
  </form>
  <p v-else>
    <Button type="button" @click="signIn">Sign in with Discord to participate</Button>
  </p>
</template>
<style scoped>
.comment-form {
  display: grid;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}
.comment-form h3 {
  margin: 0;
  font-size: 1.1rem;
}
.comment-form > button {
  justify-self: start;
}
</style>
