import { getReactions, setReaction, type ReactionInput } from '../api/reactions'
import type { FeedbackReactions, ReactionKind } from '../../../shared/discussion/contracts'
import { startDiscordSignIn } from '../../../../auth/app/api/session'
import { useFeedbackWrite, feedbackWriteError } from '../../composables/useFeedbackWrite'
import { ref, onMounted } from 'vue'
import { useRequestScope } from '../../composables/useRequestScope'
import { feedbackFailure } from '../../api/errors'

/**
 * Refresh counts after each attempt so an uncertain response does not leave a stale toggle. Mount per account/post.
 * Create within setup so disposal prevents late requests from updating local state.
 */
export function useFeedbackReactions(props: { postId: string; owner: string | null }) {
  const route = useRoute()
  const reactions = ref<FeedbackReactions | null>(null)
  const readError = ref('')
  const scope = useRequestScope()

  const writeError = ref('')
  const reacting = ref(false)
  const explain = ref(false)
  const expired = ref(false)
  const reactionWrite = useFeedbackWrite()

  async function loadReactions() {
    const isCurrent = scope.startRequest()

    try {
      const result = await getReactions(props.postId)
      if (isCurrent()) {
        reactions.value = result
        readError.value = ''
      }
    } catch {
      if (isCurrent()) {
        readError.value = 'Unable to load reactions.'
      }
    }
  }

  async function react(kind: ReactionKind) {
    if (!reactions.value || reacting.value) {
      return
    }
    await saveReaction({ kind: reactions.value.mine === kind ? null : kind })
  }

  async function saveReaction(payload: ReactionInput) {
    if (reacting.value || !props.owner) {
      return
    }
    reacting.value = true
    writeError.value = ''

    try {
      await setReaction(props.postId, payload, reactionWrite.headers(payload))
      if (!scope.isActive()) {
        return
      }

      reactionWrite.complete()
      explain.value = payload.kind !== null
      await loadReactions()
    } catch (failure) {
      if (scope.isActive()) {
        writeError.value = feedbackWriteError(failure)
        expired.value = feedbackFailure(failure).status === 401
        await loadReactions()
      }
    } finally {
      if (scope.isActive()) {
        reacting.value = false
      }
    }
  }

  async function signIn() {
    const error = await startDiscordSignIn(route.fullPath)
    if (scope.isActive()) {
      writeError.value = error
    }
  }

  onMounted(loadReactions)

  return {
    reactions,
    readError,
    writeError,
    reacting,
    explain,
    expired,
    loadReactions,
    react,
    signIn,
  }
}
