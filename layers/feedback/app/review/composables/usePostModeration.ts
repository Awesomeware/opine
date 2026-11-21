import type { PostLockResult } from '../../../shared/review/contracts'
import { ref } from 'vue'
import { feedbackWriteError } from '../../api/errors'
import { useRequestScope } from '../../composables/useRequestScope'
import { archivePost, setPostLock } from '../api/moderation'

/** Own moderation requests for one mounted post/account; emit only confirmed changes. */
export function usePostModeration(
  postId: string,
  locked: (result: PostLockResult) => void,
  archived: () => void,
) {
  const busy = ref(false)
  const error = ref('')
  const scope = useRequestScope()

  async function setLocked(value: boolean) {
    if (busy.value) {
      return
    }
    busy.value = true
    error.value = ''

    try {
      const result = await setPostLock(postId, value)
      if (scope.isActive()) {
        locked(result)
      }
    } catch (failure) {
      if (scope.isActive()) {
        error.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  async function archive() {
    if (busy.value) {
      return
    }
    busy.value = true
    error.value = ''

    try {
      await archivePost(postId)
      if (scope.isActive()) {
        archived()
      }
    } catch (failure) {
      if (scope.isActive()) {
        error.value = feedbackWriteError(failure)
      }
    } finally {
      if (scope.isActive()) {
        busy.value = false
      }
    }
  }

  return { busy, error, setLocked, archive }
}
