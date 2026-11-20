<script setup lang="ts">
import type { FeedbackReactions, ReactionKind } from '../../shared/contracts'
import { authClient } from '../../../auth/app/auth-client'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ postId: string; owner: string | null }>()
const emit = defineEmits<{ contribute: [] }>()
const route = useRoute()
const endpoint = `/api/feedback/posts/${props.postId}`
const reactions = ref<FeedbackReactions | null>(null)
const reactionError = ref('')
const reacting = ref(false)
const explain = ref(false)
const expired = ref(false)
const reactionWrite = useFeedbackWrite(`reaction.${props.owner}.${props.postId}`)
let active = true
onBeforeUnmount(() => {
  active = false
})
async function loadReactions() {
  try {
    const result = await $fetch<FeedbackReactions>(`${endpoint}/reactions`)
    if (active) {
      reactions.value = result
      reactionError.value = ''
    }
  } catch {
    if (active) reactionError.value = 'Unable to load reactions.'
  }
}
async function react(kind: ReactionKind) {
  if (!reactions.value || reactionWrite.pendingBody.value) return
  await saveReaction({ kind: reactions.value.mine === kind ? null : kind })
}
async function retryReaction() {
  const pending = reactionWrite.pendingBody.value as { kind: ReactionKind | null } | null
  if (pending) await saveReaction(pending)
}
async function saveReaction(payload: { kind: ReactionKind | null }) {
  if (reacting.value || !props.owner) return
  reacting.value = true
  reactionError.value = ''
  try {
    await $fetch(`${endpoint}/reactions`, {
      method: 'PUT',
      body: payload,
      headers: reactionWrite.headers(payload),
      retry: 0,
    })
    if (!active) return
    reactionWrite.complete()
    explain.value = payload.kind !== null
    await loadReactions()
  } catch (failure) {
    if (active) {
      reactionError.value = feedbackWriteError(failure)
      expired.value = (failure as { statusCode?: number }).statusCode === 401
    }
  } finally {
    reacting.value = false
  }
}
async function signIn() {
  try {
    const result = await authClient.signIn.social({
      provider: 'discord',
      callbackURL: route.fullPath,
    })
    if (result.error) reactionError.value = 'Unable to start sign-in. Please try again.'
  } catch {
    reactionError.value = 'Unable to start sign-in. Please try again.'
  }
}
onMounted(loadReactions)
</script>
<template>
  <section class="reactions" aria-label="Reactions">
    <div class="actions">
      <template v-if="reactions">
        <UiButton
          variant="quiet"
          :aria-pressed="reactions.mine === 'agree'"
          :busy="reacting"
          :disabled="!owner || !!reactionWrite.pendingBody.value"
          @click="react('agree')"
        >
          <UiIcon name="agree" /> Agree <span>{{ reactions.agree }}</span>
        </UiButton>
        <UiButton
          variant="quiet"
          :aria-pressed="reactions.mine === 'disagree'"
          :busy="reacting"
          :disabled="!owner || !!reactionWrite.pendingBody.value"
          @click="react('disagree')"
        >
          <UiIcon name="disagree" /> Disagree <span>{{ reactions.disagree }}</span>
        </UiButton>
      </template>
      <slot />
    </div>
    <p v-if="reactionWrite.pendingBody.value && !reacting">
      A reaction is awaiting confirmation.
      <UiButton variant="quiet" @click="retryReaction">Retry pending reaction</UiButton>
    </p>
    <p v-if="reactionError" role="alert">
      {{ reactionError }}
      <UiButton variant="quiet" @click="loadReactions">Reload reactions</UiButton>
    </p>
    <UiButton v-if="expired" variant="quiet" @click="signIn">Sign in again</UiButton>
    <p v-if="reactionWrite.warning.value">{{ reactionWrite.warning.value }}</p>
    <p v-if="explain && owner" class="invitation">
      Want to expand on that?
      <UiButton variant="quiet" @click="emit('contribute')">Add a comment</UiButton>
    </p>
  </section>
</template>
<style scoped>
.reactions {
  margin-top: 1rem;
  font-size: 0.85rem;
}
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}
.actions [aria-pressed='true'] {
  color: var(--color-accent);
  box-shadow: inset 0 -2px var(--color-accent);
}
.reactions p {
  margin: 0.5rem 0 0;
}
.invitation {
  color: var(--color-text-muted);
}
</style>
