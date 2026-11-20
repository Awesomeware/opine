import { ref } from 'vue'
import { changeFollowing } from '../api/outcomes'
import { useFeedbackWrite, feedbackWriteError } from './useFeedbackWrite'
import { useRequestScope } from './useRequestScope'

/** Following refreshes server state after each attempt and never blocks publication controls. */
export function useFeedbackFollowing(
  props: { owner: string | null; postId: string },
  refresh: () => Promise<void>,
) {
  const busy = ref(false)
  const message = ref('')
  const write = useFeedbackWrite()
  const scope = useRequestScope()

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
        await refresh()
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  return { busy, message, follow }
}
