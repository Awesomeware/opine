import { feedbackWriteError } from '../../api/errors'
import { ref } from 'vue'
import { changeFollowing } from '../api/following'
import { useRequestScope } from '../../composables/useRequestScope'

/** Following refreshes server state after each attempt and never blocks publication controls. */
export function useFeedbackFollowing(
  props: { owner: string | null; postId: string },
  refresh: () => Promise<void>,
) {
  const busy = ref(false)
  const message = ref('')
  const scope = useRequestScope()

  async function follow(payload: { following: boolean }) {
    if (busy.value || !props.owner) {
      return
    }

    busy.value = true
    message.value = ''

    try {
      await changeFollowing(props.postId, payload)
      if (!scope.isActive()) {
        return
      }

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
