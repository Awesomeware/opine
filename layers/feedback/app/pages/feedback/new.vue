<script setup lang="ts">
import UiNotice from '../../../../ui/app/components/UiNotice.vue'
import { useFeedbackWrite } from '../../composables/useFeedbackWrite'
import { authClient } from '../../../../auth/app/auth-client'
import { postLimits, validatePostInput } from '../../../shared/post-input'
import type { FeedbackCategory, FeedbackTag } from '../../../shared/contracts'

useHead({ title: 'Share feedback · Opine' })
const session = authClient.useSession()
const route = useRoute()
const {
  data: categoryData,
  pending: categoriesPending,
  error: categoriesError,
  refresh,
} = useFetch<{ categories: FeedbackCategory[] }>('/api/feedback/categories')
const categories = computed(
  () => categoryData.value?.categories.filter((category) => category.isActive) ?? [],
)
const {
  data: tagData,
  pending: tagsPending,
  error: tagsError,
  refresh: refreshTags,
} = useFetch<{ tags: FeedbackTag[] }>('/api/feedback/tags')
const form = reactive({
  title: '',
  description: '',
  desiredImprovement: '',
  categoryId: '',
  tagIds: [] as string[],
})
const fieldErrors = ref<Partial<Record<keyof typeof form, string>>>({})
const busy = ref(false)
const message = ref('')
const errorSummary = ref<InstanceType<typeof UiNotice> | null>(null)
const storageMessage = ref('')
const draftOwner = ref<string | null>(null)
let pendingWrite: ReturnType<typeof useFeedbackWrite> | null = null

watch(
  () => session.value.data?.user.id,
  (id) => {
    draftOwner.value = id ?? null
    pendingWrite = id ? useFeedbackWrite(`post.${id}`) : null
    message.value = ''
    Object.assign(form, {
      title: '',
      description: '',
      desiredImprovement: '',
      categoryId: '',
      tagIds: [],
    })
    fieldErrors.value = {}
    if (!id) return
    try {
      const saved = sessionStorage.getItem(`opine.feedback.draft.${id}`)
      if (!saved) return
      const draft: unknown = JSON.parse(saved)
      if (typeof draft !== 'object' || draft === null) return
      const tagIds = (draft as Record<string, unknown>).tagIds
      if (Array.isArray(tagIds) && tagIds.every((id) => typeof id === 'string'))
        form.tagIds = tagIds
      for (const key of ['title', 'description', 'desiredImprovement', 'categoryId'] as const) {
        const value = (draft as Record<string, unknown>)[key]
        if (typeof value === 'string') form[key] = value
      }
    } catch {
      storageMessage.value = 'Your browser could not restore the saved draft.'
    }
  },
  { immediate: true },
)

watch(form, () => {
  if (!draftOwner.value) return
  try {
    sessionStorage.setItem(`opine.feedback.draft.${draftOwner.value}`, JSON.stringify(form))
  } catch {
    storageMessage.value =
      'Your draft cannot be saved in this browser. Keep this page open until you submit your feedback.'
  }
})

async function signIn() {
  busy.value = true
  message.value = ''
  try {
    const result = await authClient.signIn.social({
      provider: 'discord',
      callbackURL: '/feedback/new',
      errorCallbackURL: '/feedback/new?signIn=failed',
    })
    if (result.error) message.value = 'Unable to start sign-in. Please try again.'
  } catch {
    message.value = 'Unable to start sign-in. Please try again.'
  } finally {
    busy.value = false
  }
}

async function retrySession() {
  busy.value = true
  try {
    await session.value.refetch()
  } catch {
    message.value = 'Unable to check your session. Please try again.'
  } finally {
    busy.value = false
  }
}

async function publish() {
  if (busy.value) return
  fieldErrors.value = {}
  message.value = ''
  const pending = pendingWrite?.pendingBody.value as { tagIds?: string[] } | null
  const { tagIds, ...text } = form
  // Older uncertain submissions must retain their original payload for receipt recovery.
  const result = validatePostInput(
    pending && !('tagIds' in pending) && !tagIds.length ? text : form,
  )
  if (!result.success) {
    fieldErrors.value = result.fieldErrors
    message.value = 'Please check the highlighted fields.'
    await nextTick()
    errorSummary.value?.focus()
    return
  }
  const owner = draftOwner.value
  const write = pendingWrite
  if (!owner || !write) return
  busy.value = true
  try {
    const post = await $fetch<{ id: string }>('/api/feedback/posts', {
      method: 'POST',
      body: result.data,
      headers: write.headers(result.data),
      retry: 0,
    })
    if (draftOwner.value !== owner) return
    write.complete()
    if (draftOwner.value) {
      try {
        sessionStorage.removeItem(`opine.feedback.draft.${draftOwner.value}`)
      } catch {
        /* Publishing succeeded even if browser storage is unavailable. */
      }
    }
    await navigateTo(`/feedback/${post.id}`)
  } catch (error: unknown) {
    if (draftOwner.value !== owner) return
    const failure = error as {
      statusCode?: number
      data?: { data?: { fieldErrors?: typeof fieldErrors.value } }
    }
    if (failure.statusCode === 400 && failure.data?.data?.fieldErrors) {
      fieldErrors.value = failure.data.data.fieldErrors
      message.value = 'Please check the highlighted fields.'
      if (fieldErrors.value.tagIds) await refreshTags()
      if (fieldErrors.value.categoryId) {
        await refresh()
        if (
          !categoriesError.value &&
          !categories.value.some((category) => category.id === form.categoryId)
        ) {
          form.categoryId = ''
        }
      }
    } else if (failure.statusCode === 400) {
      message.value = 'Check your selected tags and category before submitting again.'
      fieldErrors.value.tagIds = 'Only active tags can be added. Remove any unavailable tags.'
      await refreshTags()
    } else if (failure.statusCode === 401) {
      message.value = 'Your session has expired. Sign in again to submit your saved draft.'
      await session.value.refetch()
    } else if (failure.statusCode === 429) {
      message.value = 'You are posting too quickly. Please wait before trying again.'
    } else {
      message.value =
        'Unable to confirm submission. Your draft is saved; retrying the same submission is safe.'
    }
    await nextTick()
    errorSummary.value?.focus()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main id="main-content" class="content-column form-column">
    <NuxtLink class="back-link" to="/feedback">← All feedback</NuxtLink>
    <h1>Share feedback</h1>
    <p class="intro">
      Tell us what could work better, what you’d like to see, or what’s already working well.
    </p>
    <UiNotice v-if="message" ref="errorSummary" role="alert" tabindex="-1">{{ message }}</UiNotice>
    <p v-if="route.query.signIn" role="alert">
      Sign-in was cancelled or could not be completed. You can try again.
    </p>
    <p v-if="pendingWrite?.warning.value">{{ pendingWrite.warning.value }}</p>
    <p v-if="storageMessage" role="status">{{ storageMessage }}</p>
    <p v-if="session.isPending" role="status">Checking your session…</p>
    <div v-else-if="session.error" class="panel empty-state">
      <h2>Unable to check your session</h2>
      <p>Your saved draft is still available. Retry to continue posting.</p>
      <UiButton type="button" :busy="busy" @click="retrySession">Retry posting session</UiButton>
    </div>
    <div v-else-if="!session.data" class="panel empty-state">
      <h2>Share feedback for the game</h2>
      <p>
        Sign in with Discord to share feedback. Your saved draft will be restored for your account.
      </p>
      <UiButton variant="primary" type="button" :busy="busy" @click="signIn">
        Sign in with Discord to post
      </UiButton>
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
        <label for="post-improvement"
          >Suggested improvement <span class="muted">(optional)</span></label
        ><textarea
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
          <UiButton type="button" @click="refresh()">Retry categories</UiButton>
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
          Unable to load tags. Saved selections are preserved; clear them to submit without tags.
          <UiButton type="button" @click="refreshTags()">Retry tags</UiButton>
          <UiButton
            v-if="form.tagIds.length"
            type="button"
            :disabled="busy"
            @click="form.tagIds = []"
            >Clear selected tags</UiButton
          >
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
        <UiButton
          type="submit"
          variant="primary"
          :busy="busy"
          :disabled="busy || categoriesPending || !!categoriesError || !categories.length"
        >
          {{ busy ? 'Submitting…' : 'Submit feedback' }}</UiButton
        ><NuxtLink to="/feedback">Back to feedback</NuxtLink>
      </div>
      <p class="field-help">
        Your feedback and display name will be public. Drafts stay in this browser tab until
        submitted.
      </p>
    </form>
  </main>
</template>
