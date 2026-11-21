<script setup lang="ts">
import { useFeedbackReactions } from '../composables/useFeedbackReactions'

const props = defineProps<{ postId: string; owner: string | null; locked: boolean }>()
const emit = defineEmits<{ contribute: [] }>()

const {
  reactions,
  readError,
  writeError,
  reacting,
  explain,
  expired,
  loadReactions,
  react,
  signIn,
} = useFeedbackReactions(props)
</script>
<template>
  <section class="reactions" aria-label="Reactions">
    <div class="actions">
      <template v-if="reactions">
        <UiButton
          variant="quiet"
          :aria-pressed="reactions.mine === 'agree'"
          :busy="reacting"
          :disabled="!owner || locked"
          @click="react('agree')"
        >
          <UiIcon name="agree" />
          Agree
          <span>{{ reactions.agree }}</span>
        </UiButton>
        <UiButton
          variant="quiet"
          :aria-pressed="reactions.mine === 'disagree'"
          :busy="reacting"
          :disabled="!owner || locked"
          @click="react('disagree')"
        >
          <UiIcon name="disagree" />
          Disagree
          <span>{{ reactions.disagree }}</span>
        </UiButton>
      </template>
      <slot />
    </div>
    <p v-if="readError" role="alert">
      {{ readError }}
      <UiButton variant="quiet" @click="loadReactions">Reload reactions</UiButton>
    </p>
    <p v-if="writeError" role="alert">{{ writeError }}</p>
    <UiButton v-if="expired" variant="quiet" @click="signIn">Sign in again</UiButton>
    <p v-if="explain && owner && !locked" class="invitation">
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
  color: var(--color-text);
  box-shadow: inset 0 -2px var(--color-text-muted);
  font-weight: var(--font-weight-semibold);
}
.reactions p {
  margin: 0.5rem 0 0;
}
.invitation {
  color: var(--color-text-muted);
}
</style>
