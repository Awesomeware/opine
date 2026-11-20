import { parseComposerDraft } from '../utils/comment-draft'
import { ref, computed, watch } from 'vue'
import { type ContributionType } from '../../shared/contribution-types'
import { validateCommentInput } from '../../shared/participation-input'
import { createComment } from '../api/discussion'
import { feedbackFailure } from '../api/errors'
import { isRecord, writeStoredValue, removeStoredValue } from '../utils/stored-input'
import { startDiscordSignIn } from '../../../auth/app/api/session'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'

/** Draft and receipt keys belong to the mounted account/post; remount on either change. */
export function useCommentComposer(
  props: { postId: string; owner: string | null },
  submitted: () => Promise<void>,
) {
  const route = useRoute()
  const body = ref('')
  const type = ref<ContributionType | ''>('')
  const busy = ref(false)
  const message = ref('')
  const fieldErrors = ref<Record<string, string>>({})
  const expired = ref(false)

  const draftKey = `opine.feedback.comment.${props.owner}.${props.postId}`
  const commentWrite = useFeedbackWrite(`comment.${props.owner}.${props.postId}`)
  const scope = useRequestScope()

  // Early versions stored plain text; newer drafts carry an explicit contribution type.
  if (props.owner) {
    try {
      const saved = parseComposerDraft(sessionStorage.getItem(draftKey) ?? '')
      body.value = saved.body
      type.value = saved.type
    } catch {
      message.value = 'Your comment draft could not be restored.'
    }
  }

  watch(
    [body, type],
    () => {
      if (!props.owner) {
        return
      }
      if (!writeStoredValue(draftKey, { body: body.value, type: type.value })) {
        message.value = 'Your comment cannot be saved in this browser. Keep this page open.'
      }
    },
    { flush: 'sync' },
  )

  async function signIn() {
    const error = await startDiscordSignIn(route.fullPath)
    if (scope.isActive()) {
      message.value = error
    }
  }

  // Body-only receipts can be recovered, but cannot create new untyped comments.
  const legacyPending = computed(() => {
    const pending = commentWrite.pendingBody.value
    return isRecord(pending) &&
      typeof pending.body === 'string' &&
      Object.keys(pending).every((key) => key === 'body')
      ? { body: pending.body }
      : null
  })
  if (legacyPending.value && !body.value) {
    body.value = legacyPending.value.body
  }

  async function retryLegacyComment() {
    if (legacyPending.value) {
      await sendComment(legacyPending.value, true)
    }
  }

  async function submitComment() {
    if (busy.value || !props.owner || legacyPending.value) {
      return
    }
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
    if (busy.value || !props.owner) {
      return
    }

    busy.value = true
    message.value = ''

    try {
      const result = await createComment(props.postId, payload, commentWrite.headers(payload))
      if (!scope.isActive()) {
        return
      }

      commentWrite.complete()
      const preservesNewerDraft =
        legacy && (body.value.trim() !== payload.body.trim() || !!type.value)
      if (preservesNewerDraft) {
        message.value =
          'Your earlier submission was recovered. Your newer draft is still in the form.'
      } else {
        body.value = ''
        type.value = ''
        removeStoredValue(draftKey)
      }
      await navigateTo({
        path: `/feedback/${props.postId}`,
        query: { ...route.query, response: undefined, comment: result.id },
        hash: `#comment-${result.id}`,
      })
      if (scope.isActive()) {
        await submitted()
      }
    } catch (failure) {
      if (scope.isActive()) {
        if (legacy && feedbackFailure(failure).status === 400) {
          commentWrite.complete()
          message.value =
            'The earlier submission was not saved. Choose a contribution type and submit your preserved draft.'
        } else {
          message.value = feedbackWriteError(failure)
        }
        expired.value = feedbackFailure(failure).status === 401
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  return {
    body,
    type,
    busy,
    message,
    fieldErrors,
    expired,
    commentWrite,
    legacyPending,
    signIn,
    retryLegacyComment,
    submitComment,
  }
}
