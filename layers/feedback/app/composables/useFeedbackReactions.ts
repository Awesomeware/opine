import { getReactions, setReaction, type ReactionInput } from '../api/reactions'
import type { FeedbackReactions, ReactionKind } from '../../shared/contracts'
import { startDiscordSignIn } from '../../../auth/app/api/session'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { ref, onMounted } from 'vue'
import { useRequestScope } from './useRequestScope'
import { feedbackFailure } from '../api/errors'
import { isRecord } from '../utils/stored-input'

function isReactionInput(value: unknown): value is ReactionInput {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    (value.kind === null || value.kind === 'agree' || value.kind === 'disagree')
  )
}

/**
 * Keep counts separate from the pending write so a failed refresh never implies a failed reaction. Mount per account/post.
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
  const reactionWrite = useFeedbackWrite(`reaction.${props.owner}.${props.postId}`)

  // Invalid persisted data cannot safely identify a mutation to replay.
  const restored = reactionWrite.pendingBody.value
  if (restored !== null && !isReactionInput(restored)) {
    reactionWrite.complete()
    writeError.value = 'An invalid saved reaction was discarded. Choose your reaction again.'
  }

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
    if (!reactions.value || reactionWrite.pendingBody.value) {
      return
    }
    await saveReaction({ kind: reactions.value.mine === kind ? null : kind })
  }

  async function retryReaction() {
    const pending = reactionWrite.pendingBody.value
    // Replay only a checked payload; never turn malformed storage into a mutation.
    if (isReactionInput(pending)) {
      await saveReaction({ kind: pending.kind })
    }
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
    reactionWrite,
    loadReactions,
    react,
    retryReaction,
    signIn,
  }
}
