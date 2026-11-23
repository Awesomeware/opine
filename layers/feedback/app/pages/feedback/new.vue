<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Button from '../../../../ui/app/components/Button.vue'
import FeedbackTagPicker from '../../posts/components/FeedbackTagPicker.vue'
import Notice from '../../../../ui/app/components/Notice.vue'
import { useFeedbackSubmission } from '../../posts/composables/useFeedbackSubmission'
import { postLimits } from '../../../shared/posts/input'

useHead({ title: 'Share feedback · Opine' })
const route = useRoute()
const submission = useFeedbackSubmission()
const {
  session,
  categories,
  categoriesPending,
  categoriesError,
  refresh,
  tagData,
  tagsPending,
  tagsError,
  refreshTags,
  form,
  fieldErrors,
  busy,
  message,
  signIn,
  retrySession,
  clearTags,
} = submission
const errorSummary = ref<InstanceType<typeof Notice> | null>(null)

async function publish() {
  const id = await submission.publish()
  if (id) {
    await navigateTo(`/feedback/${id}`)
  } else if (message.value) {
    await nextTick()
    errorSummary.value?.focus()
  }
}
</script>

<template>
  <main id="main-content" tabindex="-1" class="content-column form-column">
    <NuxtLink class="back-link" to="/feedback">← All feedback</NuxtLink>
    <h1>Share feedback</h1>
    <p class="intro">
      Tell us what could work better, what you’d like to see, or what’s already working well. Read
      the
      <NuxtLink
        to="/rules"
        target="_blank"
        rel="noopener"
        aria-label="community rules (opens in a new tab)"
      >
        community rules
      </NuxtLink>
      before posting.
    </p>
    <Notice v-if="message" ref="errorSummary" role="alert" tabindex="-1">{{ message }}</Notice>
    <p v-if="route.query.signIn" role="alert">
      Sign-in was cancelled or could not be completed. You can try again.
    </p>
    <p v-if="session.isPending" role="status">Checking your session…</p>
    <div v-else-if="session.error" class="panel empty-state">
      <h2>Unable to check your session</h2>
      <p>Retry to continue posting.</p>
      <Button type="button" :busy="busy" @click="retrySession">Retry posting session</Button>
    </div>
    <div v-else-if="!session.data" class="panel empty-state">
      <h2>Share feedback for the game</h2>
      <p>Sign in with Discord to share feedback.</p>
      <Button variant="primary" type="button" :busy="busy" @click="signIn">
        Sign in with Discord to post
      </Button>
    </div>
    <form v-else class="panel feedback-form" novalidate @submit.prevent="publish">
      <p class="field-help">
        Title, feedback, and category are required. Suggested improvement and tags are optional.
      </p>
      <div class="field">
        <label for="post-title">Title</label>
        <p id="title-help" class="field-help">Give your feedback a clear, specific title.</p>
        <input
          :readonly="busy"
          id="post-title"
          v-model="form.title"
          required
          :maxlength="postLimits.title"
          :aria-invalid="!!fieldErrors.title"
          :aria-describedby="fieldErrors.title ? 'title-help title-error' : 'title-help'"
        />
        <p v-if="fieldErrors.title" id="title-error" class="field-error">{{ fieldErrors.title }}</p>
      </div>
      <div class="field">
        <label for="post-description">Feedback</label>
        <p id="description-help" class="field-help">
          Describe your feedback and why it matters. Include examples or details where helpful.
        </p>
        <textarea
          :readonly="busy"
          id="post-description"
          v-model="form.description"
          required
          rows="8"
          :maxlength="postLimits.description"
          :aria-invalid="!!fieldErrors.description"
          :aria-describedby="
            fieldErrors.description ? 'description-help description-error' : 'description-help'
          "
        />
        <p v-if="fieldErrors.description" id="description-error" class="field-error">
          {{ fieldErrors.description }}
        </p>
      </div>
      <div class="field">
        <label for="post-improvement">
          Suggested improvement
          <span class="muted">(optional)</span>
        </label>
        <textarea
          :readonly="busy"
          id="post-improvement"
          v-model="form.desiredImprovement"
          rows="4"
          :maxlength="postLimits.desiredImprovement"
          :aria-invalid="!!fieldErrors.desiredImprovement"
          :aria-describedby="fieldErrors.desiredImprovement ? 'improvement-error' : undefined"
        />
        <p v-if="fieldErrors.desiredImprovement" id="improvement-error" class="field-error">
          {{ fieldErrors.desiredImprovement }}
        </p>
      </div>
      <div class="field">
        <label for="post-category">Category</label>
        <p v-if="categoriesPending" role="status">Loading categories…</p>
        <div v-else-if="categoriesError" role="alert">
          <p>Unable to load categories.</p>
          <Button type="button" @click="refresh()">Retry categories</Button>
        </div>
        <select
          id="post-category"
          v-model="form.categoryId"
          required
          :disabled="busy || categoriesPending || !!categoriesError"
          :aria-invalid="!!fieldErrors.categoryId"
          :aria-describedby="fieldErrors.categoryId ? 'category-error' : undefined"
        >
          <option disabled value="">Choose a category</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <p v-if="fieldErrors.categoryId" id="category-error" class="field-error">
          {{ fieldErrors.categoryId }}
        </p>
        <p v-if="!categoriesPending && !categoriesError && !categories.length" role="status">
          No categories are available for new feedback yet.
        </p>
      </div>
      <div>
        <p v-if="tagsPending" role="status">Loading tags…</p>
        <p v-else-if="tagsError" role="alert">
          Unable to load tags. Your selections are preserved; clear them to submit without tags.
          <Button type="button" @click="refreshTags()">Retry tags</Button>
          <Button v-if="form.tagIds.length" type="button" :disabled="busy" @click="clearTags">
            Clear selected tags
          </Button>
        </p>
        <FeedbackTagPicker
          v-else
          v-model="form.tagIds"
          :tags="tagData?.tags ?? []"
          name="post-tags"
          :disabled="busy"
          :error="fieldErrors.tagIds"
        />
      </div>
      <div class="form-actions">
        <Button
          type="submit"
          variant="primary"
          :busy="busy"
          :disabled="busy || categoriesPending || !!categoriesError || !categories.length"
        >
          {{ busy ? 'Submitting…' : 'Submit feedback' }}
        </Button>
        <NuxtLink to="/feedback">Back to feedback</NuxtLink>
      </div>
      <p class="field-help">Your feedback and display name will be public.</p>
    </form>
  </main>
</template>
