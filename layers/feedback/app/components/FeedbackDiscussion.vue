<script setup lang="ts">
import type {
  FeedbackComment,
  FeedbackDiscussionPage,
  OfficialResponse,
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
type Entry = FeedbackDiscussionPage['entries'][number]
const entries = ref<Entry[]>([])
const comments = computed(() =>
  entries.value.flatMap((entry) => (entry.kind === 'comment' ? [entry.comment] : [])),
)
const targetResponse = ref<OfficialResponse | null>(null)
const target = ref<FeedbackComment | null>(null)
const nextCursor = ref<string | null>(null)
const loaded = ref(false)
const loading = ref(false)
const error = ref('')
const body = ref('')
const type = ref<ContributionType | ''>('')
const filter = computed(() =>
  isContributionType(route.query.contribution) || route.query.contribution === 'team'
    ? route.query.contribution
    : undefined,
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
    const page = await $fetch<FeedbackDiscussionPage>(`${endpoint}/discussion`, {
      query: {
        ...(selected ? { type: selected } : {}),
        ...(more && nextCursor.value ? { cursor: nextCursor.value } : {}),
      },
    })
    if (!active || request !== commentsRequest) return
    entries.value = more ? [...entries.value, ...page.entries] : page.entries
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
  targetResponse.value = null
  const responseId = route.query.response
  if (typeof responseId === 'string') {
    try {
      const result = await $fetch<{ response: OfficialResponse }>(
        `${endpoint}/responses/${encodeURIComponent(responseId)}`,
      )
      if (!active || request !== targetRequest) return
      targetResponse.value = result.response
      await nextTick()
      document.getElementById(`response-${responseId}`)?.scrollIntoView({ block: 'center' })
    } catch {
      if (active && request === targetRequest)
        error.value = 'The linked official response could not be loaded.'
    }
    return
  }
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
      query: { ...route.query, response: undefined, comment: result.id },
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
const visibleEntries = computed(() => {
  const result = [...entries.value]
  if (target.value && !comments.value.some((comment) => comment.id === target.value?.id))
    result.unshift({ kind: 'comment', comment: target.value })
  if (
    targetResponse.value &&
    !result.some(
      (entry) => entry.kind === 'response' && entry.response.id === targetResponse.value?.id,
    )
  )
    result.unshift({ kind: 'response', response: targetResponse.value })
  return result
})
async function selectFilter(value?: ContributionType | 'team') {
  await navigateTo({ query: { ...route.query, contribution: value }, hash: route.hash })
}
watch(filter, () => {
  entries.value = []
  nextCursor.value = null
  loaded.value = false
  void loadComments()
})
watch(() => [route.query.comment, route.query.response], loadTarget)
defineExpose({ refresh: retryComments, focusComposer: () => commentInput.value?.focus() })
onMounted(async () => {
  await loadComments()
  await loadTarget()
})
</script>
<template>
  <section class="participation" aria-labelledby="comments-heading">
    <h2 id="comments-heading">Community contributions</h2>
    <nav class="discussion-filters" aria-label="Filter contributions">
      <UiButton variant="tab" type="button" :aria-pressed="!filter" @click="selectFilter()"
        >All</UiButton
      >
      <UiButton
        variant="tab"
        v-for="kind in contributionTypes"
        :key="kind"
        type="button"
        :aria-pressed="filter === kind"
        @click="selectFilter(kind)"
      >
        {{ contributionFilterLabels[kind] }}
      </UiButton>
      <UiButton
        variant="tab"
        type="button"
        :aria-pressed="filter === 'team'"
        @click="selectFilter('team')"
      >
        Official responses
      </UiButton>
    </nav>
    <p class="field-help">Oldest first. Context, questions, and differing views are welcome.</p>
    <p v-if="error" role="alert">
      {{ error }} <UiButton type="button" @click="retryComments">Retry comments</UiButton>
    </p>
    <p v-if="loading">Loading comments…</p>
    <p v-else-if="loaded && !entries.length">
      {{ filter ? 'No contributions of this type yet.' : 'No contributions yet.' }}
    </p>
    <template
      v-for="entry in visibleEntries"
      :key="entry.kind === 'comment' ? entry.comment.id : entry.response.id"
    >
      <FeedbackOfficialResponse
        v-if="entry.kind === 'response'"
        :response="entry.response"
        :linked="route.query.response === entry.response.id"
        :outside="
          !entries.some(
            (item) => item.kind === 'response' && item.response.id === entry.response.id,
          )
        "
        ><template #link="{ href }"
          ><NuxtLink :to="href">Response link</NuxtLink></template
        ></FeedbackOfficialResponse
      >
      <template v-else>
        <article
          v-for="comment in [entry.comment]"
          :id="`comment-${comment.id}`"
          :key="comment.id"
          class="comment"
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
          <header class="comment-header">
            <span class="author-initial" aria-hidden="true">{{
              comment.author.name.trim().slice(0, 1).toUpperCase()
            }}</span>
            <strong>{{ comment.author.name }}</strong>
            <span class="contribution-label"
              ><FeedbackContributionIcon v-if="comment.type" :type="comment.type" />{{
                comment.type ? contributionLabels[comment.type] : 'Unspecified'
              }}</span
            >
            <time
              :datetime="comment.createdAt"
              :title="new Date(comment.createdAt).toLocaleString()"
              >{{
                new Date(comment.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              }}</time
            >
            <span v-if="comment.editedAt" :title="new Date(comment.editedAt).toLocaleString()"
              >Edited</span
            >
          </header>
          <p v-if="!comment.type" class="field-help">
            This comment was posted before contribution types were introduced.
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
                query: { ...route.query, response: undefined, comment: comment.id },
                hash: `#comment-${comment.id}`,
              }"
              >Comment link</NuxtLink
            ><UiButton
              variant="quiet"
              v-if="comment.canEdit && owner && editing !== comment.id"
              type="button"
              @click="editing = comment.id"
            >
              Edit comment
            </UiButton>
          </div>
        </article>
      </template></template
    >
    <UiButton
      v-if="nextCursor"
      type="button"
      :busy="loading"
      :disabled="loading"
      @click="loadComments(true)"
    >
      Load more comments
    </UiButton>
    <UiButton v-if="expired" type="button" @click="signIn">Sign in again</UiButton>
    <p v-if="message" role="alert">{{ message }}</p>
    <p v-if="commentWrite.warning.value">{{ commentWrite.warning.value }}</p>
    <form v-if="owner" class="comment-form" novalidate @submit.prevent="submitComment">
      <h3>Add a contribution</h3>
      <p v-if="legacyPending" role="status">
        An earlier submission is awaiting confirmation. Recover it before creating another comment.
        <UiButton type="button" :busy="busy" @click="retryLegacyComment">
          Recover earlier submission
        </UiButton>
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
      <UiButton variant="primary" type="submit" :busy="busy" :disabled="busy || !!legacyPending">
        {{ busy ? 'Submitting…' : 'Submit comment' }}
      </UiButton>
    </form>
    <p v-else>
      <UiButton type="button" @click="signIn">Sign in with Discord to participate</UiButton>
    </p>
  </section>
</template>
<style scoped>
.participation {
  margin-top: 2rem;
}
h2 {
  font-size: 1.5rem;
  margin: 0 0 0.75rem;
}
.discussion-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0 0.9rem;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.75rem;
}
.participation > .field-help {
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}
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
