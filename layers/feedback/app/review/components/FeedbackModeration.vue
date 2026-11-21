<script setup lang="ts">
import type { PostLockResult } from '../../../shared/review/contracts'
import { nextTick, onMounted, ref, useId } from 'vue'
import UiButton from '../../../../ui/app/components/UiButton.vue'
import { usePostModeration } from '../composables/usePostModeration'

const props = defineProps<{ postId: string; lockedAt: string | null; autofocus?: boolean }>()
const emit = defineEmits<{ locked: [result: PostLockResult]; archived: []; focused: [] }>()
const confirmingArchive = ref(false)
const confirmationId = useId()
const lockButton = ref<InstanceType<typeof UiButton> | null>(null)
const archiveButton = ref<InstanceType<typeof UiButton> | null>(null)
const confirmButton = ref<InstanceType<typeof UiButton> | null>(null)

const { busy, error, setLocked, archive } = usePostModeration(
  props.postId,
  (result) => emit('locked', result),
  () => emit('archived'),
)

onMounted(() => {
  if (props.autofocus) {
    lockButton.value?.focus()
    emit('focused')
  }
})

async function showArchiveConfirmation() {
  confirmingArchive.value = true
  await nextTick()
  confirmButton.value?.focus()
}

async function cancelArchive() {
  confirmingArchive.value = false
  await nextTick()
  archiveButton.value?.focus()
}
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
      <UiButton ref="lockButton" :disabled="busy" @click="setLocked(!lockedAt)">
        {{ lockedAt ? 'Unlock feedback' : 'Lock feedback' }}
      </UiButton>
      <UiButton
        ref="archiveButton"
        :disabled="busy"
        :aria-expanded="confirmingArchive"
        :aria-controls="confirmationId"
        @click="showArchiveConfirmation"
      >
        Archive feedback
      </UiButton>
    </div>
    <div v-show="confirmingArchive" :id="confirmationId" class="confirmation">
      <p :id="`${confirmationId}-description`">
        Archive this feedback and all its contributions? It will disappear for everyone, including
        community managers. There is no restore option in the app.
      </p>
      <div class="actions">
        <UiButton
          ref="confirmButton"
          :aria-describedby="`${confirmationId}-description`"
          :busy="busy"
          :disabled="busy"
          @click="archive"
        >
          Confirm archive
        </UiButton>
        <UiButton :disabled="busy" variant="quiet" @click="cancelArchive">Cancel</UiButton>
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
