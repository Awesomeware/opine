<script setup lang="ts">
import FeedbackText from '../../components/FeedbackText.vue'
import { nextTick, ref } from 'vue'
import Button from '../../../../ui/app/components/Button.vue'
import type { FeedbackComment } from '../../../shared/discussion/contracts'
import { contributionLabels } from '../../../shared/discussion/contribution-types'
import FeedbackCommentEditor from './FeedbackCommentEditor.vue'

const props = defineProps<{
  comment: FeedbackComment
  owner: string | null
  linked: boolean
  outside: boolean
  outsideFilter: boolean
}>()
const emit = defineEmits<{ saved: [] }>()
const route = useRoute()
const postId = props.comment.postId
const editing = ref(false)
const editButton = ref<InstanceType<typeof Button> | null>(null)

async function closeEditor() {
  editing.value = false
  await nextTick()
  editButton.value?.focus()
}

function saved() {
  void closeEditor()
  emit('saved')
}
</script>
<template>
  <article :id="`comment-${comment.id}`" class="comment" :class="{ linked }">
    <p v-if="outside" class="field-help">
      Linked comment ·
      {{ outsideFilter ? 'outside the selected filter' : 'outside the current page' }}
    </p>
    <header class="comment-header">
      <span class="author-initial" aria-hidden="true">
        {{ comment.author.name.trim().slice(0, 1).toUpperCase() }}
      </span>
      <strong>{{ comment.author.name }}</strong>
      <span class="contribution-label">
        <FeedbackContributionIcon v-if="comment.type" :type="comment.type" />
        {{ comment.type ? contributionLabels[comment.type] : 'Unspecified' }}
      </span>
      <time :datetime="comment.createdAt" :title="new Date(comment.createdAt).toLocaleString()">
        {{
          new Date(comment.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })
        }}
      </time>
      <span v-if="comment.editedAt" :title="new Date(comment.editedAt).toLocaleString()">
        Edited
      </span>
    </header>
    <p v-if="!comment.type" class="field-help">
      This comment was posted before contribution types were introduced.
    </p>
    <FeedbackCommentEditor
      v-if="editing && owner"
      :owner="owner"
      :comment="comment"
      @saved="saved"
      @cancel="closeEditor"
    />
    <FeedbackText v-else :text="comment.body" />
    <div class="comment-actions">
      <NuxtLink
        :to="{
          path: `/feedback/${postId}`,
          query: { ...route.query, response: undefined, comment: comment.id },
          hash: `#comment-${comment.id}`,
        }"
      >
        Comment link
      </NuxtLink>
      <Button
        ref="editButton"
        variant="quiet"
        v-if="comment.canEdit && owner && !editing"
        type="button"
        @click="editing = true"
      >
        Edit comment
      </Button>
    </div>
  </article>
</template>
<style scoped>
.comment {
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border);
  scroll-margin-top: 2rem;
  overflow-wrap: anywhere;
}
.comment-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
.comment-header strong {
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}
.comment-header time {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}
.author-initial {
  display: inline-grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}
.contribution-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}
.comment-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.8rem;
}
.comment-actions a {
  color: var(--color-text-muted);
}
.comment-actions a:hover {
  color: var(--color-text);
}
.linked {
  outline: 2px solid var(--color-accent);
  outline-offset: 4px;
}
</style>
