<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { PostLockResult } from '../../../shared/review/contracts'
import FeedbackModeration from './FeedbackModeration.vue'
import { statusLabels, postStatuses } from '../../../shared/status'
import { useOfficialPublication } from '../composables/useOfficialPublication'
import { useFeedbackFollowing } from '../../subscriptions/composables/useFeedbackFollowing'

const props = defineProps<{
  postId: string
  owner: string | null
  lockedAt: string | null
  focusModeration?: boolean
}>()
const emit = defineEmits<{
  published: []
  locked: [result: PostLockResult]
  archived: []
  moderationFocused: []
}>()

const {
  outcome,
  reviewing,
  reviewError,
  error,
  busy,
  message,
  bodyError,
  conflict,
  latest,
  form,
  load,
  publish,
  loadLatest,
  acceptLatest,
} = useOfficialPublication(props, () => emit('published'))
const { busy: followBusy, message: followMessage, follow } = useFeedbackFollowing(props, load)

const responseInput = ref<HTMLTextAreaElement | null>(null)

async function reviewLatest() {
  acceptLatest()
  await nextTick()
  responseInput.value?.focus()
}

async function publishResponse() {
  await publish()
  if (bodyError.value) {
    responseInput.value?.focus()
  }
}
</script>
<template>
  <section aria-label="Feedback overview" class="overview">
    <div class="overview-top">
      <div class="proposal"><slot name="proposal" /></div>
      <aside aria-label="Status and following" class="status-summary">
        <p v-if="error" role="alert">
          {{ error }}
          <Button variant="quiet" @click="load">Retry outcome</Button>
        </p>
        <template v-if="outcome">
          <h2>Current status</h2>
          <FeedbackStatusBadge :status="outcome.status" />
          <p v-if="outcome.status === 'new'" class="status-explanation">
            Awaiting initial review. New does not mean the team has acknowledged this feedback.
          </p>
          <NuxtLink
            v-if="outcome.statusResponse"
            class="status-explanation"
            :to="{
              path: `/feedback/${postId}`,
              query: { response: outcome.statusResponse.id },
              hash: `#response-${outcome.statusResponse.id}`,
            }"
          >
            Why this status?
          </NuxtLink>
          <Button
            v-if="owner"
            variant="primary"
            :busy="followBusy"
            :disabled="followBusy"
            @click="follow({ following: !outcome.following })"
          >
            {{ outcome.following ? 'Unfollow updates' : 'Follow updates' }}
          </Button>
          <p class="follow-help">
            {{
              owner
                ? 'Get notified when the team publishes an official response.'
                : 'Sign in to follow official updates.'
            }}
          </p>
          <p v-if="followMessage" role="alert">{{ followMessage }}</p>
        </template>
        <p v-else-if="!error" role="status">Loading status…</p>
      </aside>
    </div>
    <p v-if="message" role="alert">{{ message }}</p>
    <template v-if="outcome">
      <FeedbackOfficialResponse
        v-if="outcome.latestResponse"
        :response="outcome.latestResponse"
        featured
      >
        <template #link="{ href }"><NuxtLink :to="href">Response link</NuxtLink></template>
      </FeedbackOfficialResponse>
      <div v-else class="awaiting-response">
        <h2>Official response</h2>
        <p>No official response yet.</p>
      </div>
      <FeedbackModeration
        v-if="owner && outcome.canModerate"
        :post-id="postId"
        :locked-at="lockedAt"
        :autofocus="focusModeration"
        @focused="emit('moderationFocused')"
        @locked="emit('locked', $event)"
        @archived="emit('archived')"
      />
      <div v-if="owner && outcome.canRespond" class="management-tools">
        <details class="response-composer">
          <summary>
            <span>Publish an official response</span>
          </summary>
          <form
            class="response-form"
            aria-label="Publish official response"
            novalidate
            @submit.prevent="publishResponse"
          >
            <p>This is a public official response. Corrections require a new response.</p>
            <div class="field">
              <label for="official-response-body">Official response</label>
              <textarea
                id="official-response-body"
                ref="responseInput"
                :aria-invalid="!!bodyError"
                :aria-describedby="bodyError ? 'official-response-error' : undefined"
                v-model="form.body"
                :readonly="busy"
                rows="5"
                maxlength="10000"
                required
              />
            </div>
            <p v-if="bodyError" id="official-response-error" class="field-error" role="alert">
              {{ bodyError }}
            </p>
            <div class="field">
              <label for="official-response-status">Status change</label>
              <select id="official-response-status" v-model="form.status" :disabled="busy">
                <option value="">Keep current status</option>
                <option v-for="status in postStatuses" :key="status" :value="status">
                  {{ statusLabels[status] }}
                </option>
              </select>
            </div>
            <div v-if="conflict">
              <p v-if="reviewError" role="alert">{{ reviewError }}</p>
              <Button type="button" :busy="reviewing" @click="loadLatest">
                Load latest outcome
              </Button>
              <div v-if="latest">
                <p>Current status: {{ statusLabels[latest.status] }}</p>
                <FeedbackOfficialResponse
                  v-if="latest.latestResponse"
                  :response="latest.latestResponse"
                  featured
                >
                  <template #link="{ href }">
                    <NuxtLink :to="href">Response link</NuxtLink>
                  </template>
                </FeedbackOfficialResponse>
                <Button type="button" @click="reviewLatest">
                  I’ve reviewed the latest outcome
                </Button>
              </div>
            </div>
            <Button variant="primary" type="submit" :busy="busy" :disabled="busy || conflict">
              {{ busy ? 'Publishing…' : 'Publish official response' }}
            </Button>
          </form>
        </details>
      </div>
    </template>
  </section>
</template>
<style scoped>
.overview-top {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 2rem;
  align-items: start;
}
.proposal {
  min-width: 0;
}
.status-summary {
  border-left: 1px solid var(--color-border);
  padding-left: 1.5rem;
  font-size: 0.85rem;
  min-width: 0;
}
.status-summary h2 {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--color-text-muted);
  margin: 0 0 0.4rem;
}
.status-explanation {
  display: block;
  margin: 0.75rem 0;
  font-size: 0.8rem;
}
.status-summary > button {
  margin-top: 0.75rem;
}
.follow-help {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}
.awaiting-response {
  border-top: 1px solid var(--color-border);
  margin-top: 1.5rem;
  padding: 1rem 0;
}
.awaiting-response h2 {
  font: 600 1rem var(--font-body);
  margin: 0 0 0.35rem;
}
.awaiting-response p {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0;
}
.management-tools {
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  margin-top: 1rem;
}
.response-composer {
  padding: 0.75rem 0;
}
summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.response-form {
  display: grid;
  gap: 1rem;
  padding: 1.25rem 0;
}
.response-form > button {
  justify-self: start;
}
.response-form > p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
@media (max-width: 760px) {
  .overview-top {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  .status-summary {
    border-left: 0;
    border-top: 1px solid var(--color-border);
    padding: 1rem 0 0;
  }
}
</style>
