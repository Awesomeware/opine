<script setup lang="ts">
import { ref } from 'vue'
import { useCommentComposer } from '../composables/useCommentComposer'

const props = defineProps<{ postId: string; owner: string | null; refresh: () => Promise<void> }>()
const { body, type, busy, message, fieldErrors, expired, signIn, submitComment } =
  useCommentComposer(props, props.refresh)
const commentInput = ref<HTMLTextAreaElement | null>(null)

function focus() {
  commentInput.value?.focus()
}

defineExpose({ focus })
</script>
<template>
  <UiButton v-if="expired" type="button" @click="signIn">Sign in again</UiButton>
  <p v-if="message" role="alert">{{ message }}</p>
  <form v-if="owner" class="comment-form" novalidate @submit.prevent="submitComment">
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
    <p class="field-help">Your comment and display name will be public.</p>
    <UiButton variant="primary" type="submit" :busy="busy" :disabled="busy">
      {{ busy ? 'Submitting…' : 'Submit comment' }}
    </UiButton>
  </form>
  <p v-else>
    <UiButton type="button" @click="signIn">Sign in with Discord to participate</UiButton>
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
