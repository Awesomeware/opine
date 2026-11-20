import { ref } from 'vue'
import { validateFollowInput } from '../../shared/outcome-input'
import { changeFollowing } from '../api/outcomes'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'

/** Following has its own pending receipt and never blocks publication controls. */
export function useFeedbackFollowing(
  props: { owner: string | null; postId: string },
  refresh: () => Promise<void>,
) {
  const busy = ref(false)
  const message = ref('')
  const write = useFeedbackWrite(`follow.${props.owner}.${props.postId}`)
  const scope = useRequestScope()

  // Invalid persisted data cannot safely identify a mutation to replay.
  const restored = write.pendingBody.value
  if (restored !== null && !validateFollowInput(restored).success) {
    write.complete()
    message.value = 'An invalid saved follow change was discarded. Choose whether to follow again.'
  }

  async function follow(payload: { following: boolean }) {
    if (busy.value || !props.owner) {
      return
    }

    busy.value = true
    message.value = ''

    try {
      await changeFollowing(props.postId, payload, write.headers(payload))
      if (!scope.isActive()) {
        return
      }

      write.complete()
      await refresh()
    } catch (failure) {
      if (scope.isActive()) {
        message.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  function retryFollow() {
    const parsed = validateFollowInput(write.pendingBody.value)
    if (parsed.success) {
      void follow(parsed.data)
    } else {
      message.value = 'The pending follow change could not be restored.'
    }
  }

  return { busy, message, write, follow, retryFollow }
}
