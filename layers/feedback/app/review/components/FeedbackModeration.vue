<script setup lang="ts">
import type { PostLockResult } from '../../../shared/review/contracts'
import { ref } from 'vue'
import { usePostModeration } from '../composables/usePostModeration'

const props = defineProps<{ postId: string; lockedAt: string | null }>()
const emit = defineEmits<{ locked: [result: PostLockResult]; archived: [] }>()
const confirmingArchive = ref(false)
const { busy, error, setLocked, archive } = usePostModeration(
  props.postId,
  (result) => emit('locked', result),
  () => emit('archived'),
)
</script>

<template>
  <section class="moderation" aria-label="Moderation">
    <h2>Moderation</h2>
    <p>
      {{
        lockedAt
          ? 'Unlock to allow contributions and changes.'
          : 'Lock to pause contributions and changes.'
      }}
    </p>
    <div class="actions">
      <UiButton :disabled="busy" @click="setLocked(!lockedAt)">
        {{ lockedAt ? 'Unlock feedback' : 'Lock feedback' }}
      </UiButton>
      <UiButton :disabled="busy" @click="confirmingArchive = true">Archive feedback</UiButton>
    </div>
    <div v-if="confirmingArchive" class="confirmation">
      <p>
        Archive this feedback and all its contributions? It will disappear for everyone, including
        community managers. There is no restore option in the app.
      </p>
      <div class="actions">
        <UiButton :busy="busy" :disabled="busy" @click="archive">Confirm archive</UiButton>
        <UiButton :disabled="busy" variant="quiet" @click="confirmingArchive = false">
          Cancel
        </UiButton>
      </div>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.moderation {
  border-top: 1px solid var(--color-border);
  margin-top: 1rem;
  padding-top: 1rem;
  font-size: 0.85rem;
}
h2 {
  font: 600 1rem var(--font-body);
  margin: 0;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.confirmation {
  margin-top: 1rem;
}
</style>
