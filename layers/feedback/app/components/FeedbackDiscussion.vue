<script setup lang="ts">
import type {
  FeedbackComment,
  FeedbackCommentsPage,
  FeedbackReactions,
  ReactionKind,
} from '../../shared/contracts'
import {
  contributionTypes,
  contributionLabels,
  contributionFilterLabels,
  isContributionType,
  type ContributionType,
} from '../../shared/contribution-types'
import { validateCommentInput } from '../../shared/participation-input'
import { authClient } from '../../../auth/app/auth-client'
import { useFeedbackWrite, feedbackWriteError } from '../composables/useFeedbackWrite'
const props = defineProps<{ postId: string; owner: string | null }>()
const route = useRoute()
const endpoint = `/api/feedback/posts/${props.postId}`
const comments = ref<FeedbackComment[]>([])
const target = ref<FeedbackComment | null>(null)
const nextCursor = ref<string | null>(null)
const loaded = ref(false)
const loading = ref(false)
const error = ref('')
const reactions = ref<FeedbackReactions | null>(null)
const reactionError = ref('')
const reacting = ref(false)
const explain = ref(false)
const body = ref('')
const type = ref<ContributionType | ''>('')
const filter = computed(() =>
  isContributionType(route.query.contribution) ? route.query.contribution : undefined,
)
let commentsRequest = 0
let targetRequest = 0
const busy = ref(false)
const message = ref('')
const fieldErrors = ref<Record<string, string>>({})
const expired = ref(false)
const editing = ref<string | null>(null)
const commentInput = ref<HTMLTextAreaElement | null>(null)
const draftKey = `opine.feedback.comment.${props.owner}.${props.postId}`
const commentWrite = useFeedbackWrite(`comment.${props.owner}.${props.postId}`)
const reactionWrite = useFeedbackWrite(`reaction.${props.owner}.${props.postId}`)
let active = true
onBeforeUnmount(() => {
  active = false
})
if (props.owner) {
  try {
    const saved = sessionStorage.getItem(draftKey) ?? ''
    body.value = saved
    try {
      const draft = JSON.parse(saved)
      if (draft && typeof draft.body === 'string') {
        body.value = draft.body
        type.value = isContributionType(draft.type) ? draft.type : ''
      }
    } catch {
      /* Earlier drafts were stored as plain text. */
    }
  } catch {
    message.value = 'Your comment draft could not be restored.'
  }
}
watch(
  [body, type],
  () => {
    if (!props.owner) return
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ body: body.value, type: type.value }))
    } catch {
      message.value = 'Your comment cannot be saved in this browser. Keep this page open.'
    }
  },
  { flush: 'sync' },
)
async function loadComments(more = false) {
  if (more && loading.value) return
  const request = ++commentsRequest
  const selected = filter.value
  loading.value = true
  error.value = ''
  try {
    const page = await $fetch<FeedbackCommentsPage>(`${endpoint}/comments`, {
      query: {
        ...(selected ? { type: selected } : {}),
        ...(more && nextCursor.value ? { cursor: nextCursor.value } : {}),
      },
    })
    if (!active || request !== commentsRequest) return
    comments.value = more ? [...comments.value, ...page.comments] : page.comments
    nextCursor.value = page.nextCursor
    loaded.value = true
  } catch {
    if (active && request === commentsRequest)
      error.value = 'Unable to load comments. Please retry.'
  } finally {
    if (request === commentsRequest) loading.value = false
  }
}
async function loadTarget() {
  const request = ++targetRequest
  target.value = null
  const id = route.query.comment
  if (typeof id !== 'string') return
  try {
    const response = await $fetch<{ comment: FeedbackComment }>(
      `${endpoint}/comments/${encodeURIComponent(id)}`,
    )
    if (!active || request !== targetRequest || route.query.comment !== id) return
    target.value = response.comment
    await nextTick()
    document.getElementById(`comment-${id}`)?.scrollIntoView({ block: 'center' })
  } catch {
    if (active && request === targetRequest && route.query.comment === id)
      error.value = 'The linked comment could not be loaded.'
  }
}
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
    if (result.error) message.value = 'Unable to start sign-in. Please try again.'
  } catch {
    message.value = 'Unable to start sign-in. Please try again.'
  }
}
const legacyPending = computed(() => {
  const pending = commentWrite.pendingBody.value
  return pending && typeof pending === 'object' && 'body' in pending && !('type' in pending)
    ? (pending as { body: string })
    : null
})
if (legacyPending.value && !body.value) body.value = legacyPending.value.body
async function retryLegacyComment() {
  if (legacyPending.value) await sendComment(legacyPending.value, true)
}
async function submitComment() {
  if (busy.value || !props.owner || legacyPending.value) return
  fieldErrors.value = {}
  const parsed = validateCommentInput({ body: body.value, type: type.value })
  if (!parsed.success) {
    fieldErrors.value = parsed.fieldErrors
    message.value = 'Please check the highlighted field.'
    return
  }
  await sendComment(parsed.data)
}
async function sendComment(payload: { body: string; type?: ContributionType }, legacy = false) {
  if (busy.value || !props.owner) return
  busy.value = true
  message.value = ''
  try {
    const result = await $fetch<{ id: string }>(`${endpoint}/comments`, {
      method: 'POST',
      body: payload,
      headers: commentWrite.headers(payload),
      retry: 0,
    })
    if (!active) return
    commentWrite.complete()
    const preservesNewerDraft =
      legacy && (body.value.trim() !== payload.body.trim() || !!type.value)
    if (preservesNewerDraft) {
      message.value =
        'Your earlier submission was recovered. Your newer draft is still in the form.'
    } else {
      body.value = ''
      type.value = ''
      try {
        sessionStorage.removeItem(draftKey)
      } catch {
        /* Submitted successfully. */
      }
    }
    await navigateTo({
      path: `/feedback/${props.postId}`,
      query: { ...route.query, comment: result.id },
      hash: `#comment-${result.id}`,
    })
    await loadComments()
    await loadTarget()
  } catch (failure) {
    if (active) {
      if (legacy && (failure as { statusCode?: number }).statusCode === 400) {
        commentWrite.complete()
        message.value =
          'The earlier submission was not saved. Choose a contribution type and submit your preserved draft.'
      } else message.value = feedbackWriteError(failure)
      expired.value = (failure as { statusCode?: number }).statusCode === 401
    }
  } finally {
    busy.value = false
  }
}
async function retryComments() {
  await loadComments()
  await loadTarget()
}
async function savedComment() {
  editing.value = null
  await loadComments()
  await loadTarget()
}
const visibleComments = computed(() =>
  target.value && !comments.value.some((comment) => comment.id === target.value?.id)
    ? [target.value, ...comments.value]
    : comments.value,
)
async function selectFilter(value?: ContributionType) {
  await navigateTo({ query: { ...route.query, contribution: value }, hash: route.hash })
}
watch(filter, () => {
  comments.value = []
  nextCursor.value = null
  loaded.value = false
  void loadComments()
})
watch(() => route.query.comment, loadTarget)
onMounted(async () => {
  await Promise.all([loadComments(), loadReactions()])
  await loadTarget()
})
</script>
<template>
  <section class="reaction-summary" aria-label="Reactions">
    <div v-if="reactions" class="reaction-actions">
      <button
        type="button"
        :aria-pressed="reactions.mine === 'agree'"
        :disabled="!owner || reacting || !!reactionWrite.pendingBody.value"
        @click="react('agree')"
      >
        <span aria-hidden="true">👍</span> Agree <span>{{ reactions.agree }}</span></button
      ><button
        type="button"
        :aria-pressed="reactions.mine === 'disagree'"
        :disabled="!owner || reacting || !!reactionWrite.pendingBody.value"
        @click="react('disagree')"
      >
        <span aria-hidden="true">👎</span> Disagree <span>{{ reactions.disagree }}</span>
      </button>
    </div>
    <p v-if="reactionWrite.pendingBody.value && !reacting">
      A reaction is awaiting confirmation.
      <button type="button" @click="retryReaction">Retry pending reaction</button>
    </p>
    <p class="field-help">
      Choose one response. Select it again to remove it. Reactions do not affect visibility or
      ranking.
    </p>
    <p v-if="reactionError" role="alert">
      {{ reactionError }} <button type="button" @click="loadReactions">Reload reactions</button>
    </p>
    <p v-if="reactionWrite.warning.value">{{ reactionWrite.warning.value }}</p>
    <p v-if="explain && owner">
      Want to explain? <button type="button" @click="commentInput?.focus()">Add a comment</button>
    </p>
  </section>
  <section class="participation" aria-labelledby="comments-heading">
    <h2 id="comments-heading">Community contributions</h2>
    <nav class="discussion-filters" aria-label="Filter contributions">
      <button type="button" :aria-pressed="!filter" @click="selectFilter()">All</button>
      <button
        v-for="kind in contributionTypes"
        :key="kind"
        type="button"
        :aria-pressed="filter === kind"
        @click="selectFilter(kind)"
      >
        {{ contributionFilterLabels[kind] }}
      </button>
    </nav>
    <p class="field-help">
      Oldest comments first. Keep replies constructive and focused on the feedback.
    </p>
    <p v-if="error" role="alert">
      {{ error }} <button type="button" @click="retryComments">Retry comments</button>
    </p>
    <p v-if="loading">Loading comments…</p>
    <p v-else-if="loaded && !comments.length">
      {{ filter ? 'No contributions of this type yet.' : 'No contributions yet.' }}
    </p>
    <article
      v-for="comment in visibleComments"
      :id="`comment-${comment.id}`"
      :key="comment.id"
      class="comment panel"
      :class="{ linked: route.query.comment === comment.id }"
    >
      <p
        v-if="target?.id === comment.id && !comments.some((item) => item.id === comment.id)"
        class="field-help"
      >
        Linked comment ·
        {{
          filter && comment.type !== filter
            ? 'outside the selected filter'
            : 'outside the current page'
        }}
      </p>
      <p class="contribution-label">
        {{ comment.type ? contributionLabels[comment.type] : 'Unspecified' }}
      </p>
      <p v-if="!comment.type" class="field-help">
        This comment was posted before contribution types were introduced.
      </p>
      <p class="byline">
        <strong>{{ comment.author.name }}</strong> ·
        <time :datetime="comment.createdAt">{{ new Date(comment.createdAt).toLocaleString() }}</time
        ><span v-if="comment.editedAt" :title="new Date(comment.editedAt).toLocaleString()">
          · Edited</span
        >
      </p>
      <FeedbackEditor
        v-if="editing === comment.id && owner"
        :owner="owner"
        :endpoint="`${endpoint}/comments/${comment.id}`"
        :body="comment.body"
        :type="comment.type"
        :version="comment.version"
        @saved="savedComment"
        @cancel="editing = null"
      />
      <FeedbackText v-else :text="comment.body" />
      <div class="comment-actions">
        <NuxtLink
          :to="{
            path: `/feedback/${postId}`,
            query: { ...route.query, comment: comment.id },
            hash: `#comment-${comment.id}`,
          }"
          >Comment link</NuxtLink
        ><button
          v-if="comment.canEdit && owner && editing !== comment.id"
          type="button"
          @click="editing = comment.id"
        >
          Edit comment
        </button>
      </div>
    </article>
    <button v-if="nextCursor" type="button" :disabled="loading" @click="loadComments(true)">
      Load more comments
    </button>
    <button v-if="expired" type="button" @click="signIn">Sign in again</button>
    <p v-if="message" role="alert">{{ message }}</p>
    <p v-if="commentWrite.warning.value">{{ commentWrite.warning.value }}</p>
    <form
      v-if="owner"
      class="panel feedback-form comment-form"
      novalidate
      @submit.prevent="submitComment"
    >
      <p v-if="legacyPending" role="status">
        An earlier submission is awaiting confirmation. Recover it before creating another comment.
        <button type="button" :disabled="busy" @click="retryLegacyComment">
          Recover earlier submission
        </button>
      </p>
      <FeedbackContributionType
        v-model="type"
        name="new-contribution-type"
        :disabled="busy || !!legacyPending"
        :error="fieldErrors.type"
      />
      <div class="field">
        <label for="new-comment">Add a comment</label
        ><textarea
          :readonly="busy || !!legacyPending"
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
        Your comment and display name will be public. Drafts stay in this browser tab.
      </p>
      <button type="submit" :disabled="busy || !!legacyPending">
        {{ busy ? 'Submitting…' : 'Submit comment' }}
      </button>
    </form>
    <p v-else><button type="button" @click="signIn">Sign in with Discord to participate</button></p>
  </section>
</template>
<style scoped>
.reaction-summary {
  margin-top: 1.5rem;
}
.discussion-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1rem 0;
}
.discussion-filters [aria-pressed='true'] {
  outline: 2px solid currentColor;
}
.contribution-label {
  font-weight: 700;
}
.participation {
  margin-top: 2.5rem;
  border-top: 1px solid var(--border, #ddd);
  padding-top: 1.5rem;
}
.reaction-actions,
.comment-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}
.reaction-actions [aria-pressed='true'] {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
.reaction-actions button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.comment {
  margin: 1rem 0;
  padding: 1.25rem;
  scroll-margin-top: 2rem;
  overflow-wrap: anywhere;
}
.linked {
  border: 2px solid currentColor;
}
.comment-form {
  margin-top: 1.5rem;
}
</style>
