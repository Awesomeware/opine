import { ref, computed } from 'vue'
import { feedbackFailure } from '../api/errors.ts'
import { isUuid } from '../../shared/post-input.ts'
import {
  isRecord,
  readStoredValue,
  writeStoredValue,
  removeStoredValue,
} from '../utils/stored-input.ts'

/**
 * Persist the exact payload and request key for one account/resource operation.
 * Call headers only for an explicit submission or retry; this never sends a request.
 * Complete only after confirmation (or a deliberate discard after definite rejection).
 * Keep the scope stable for this mount and remount when its account/resource changes.
 */
export function useFeedbackWrite(scope: string) {
  const storageKey = `opine.feedback.pending.${scope}`
  const warning = ref('')
  const pending = ref<{ payload: string; key: string } | null>(null)
  const stored = readStoredValue(storageKey)

  if (stored.success) {
    const value = stored.value

    if (isRecord(value) && typeof value.payload === 'string' && isUuid(value.key)) {
      try {
        // Decode only to check validity. Re-encoding could change a legacy fingerprint.
        JSON.parse(value.payload)
        pending.value = { payload: value.payload, key: value.key }
      } catch {
        warning.value = 'The pending request could not be restored. Keep this page open.'
      }
    } else if (value !== null) {
      warning.value =
        'The pending request could not be restored. Review your input before submitting.'
    }
  } else {
    warning.value = 'Browser storage is unavailable. Keep this page open to retry safely.'
  }

  function headers(body: unknown) {
    const payload = JSON.stringify(body)

    if (pending.value?.payload !== payload) {
      pending.value = { payload, key: crypto.randomUUID() }
    }

    if (!writeStoredValue(storageKey, pending.value)) {
      warning.value = 'Browser storage is unavailable. Keep this page open to retry safely.'
    }

    return { 'Idempotency-Key': pending.value.key }
  }

  function complete() {
    pending.value = null
    removeStoredValue(storageKey)
  }

  const pendingBody = computed<unknown>(() =>
    pending.value ? JSON.parse(pending.value.payload) : null,
  )

  return { headers, complete, warning, pendingBody }
}

export function feedbackWriteError(error: unknown) {
  const { status } = feedbackFailure(error)

  if (status === 401) {
    return 'Your session has expired. Sign in again to continue.'
  }

  if (status === 403) {
    return 'You do not have permission to make this change.'
  }

  if (status === 404) {
    return 'This feedback is no longer available.'
  }

  if (status === 429) {
    return 'You are posting too quickly. Please wait before trying again.'
  }

  if (status === 400) {
    return 'Check your text and try again.'
  }

  return 'Unable to confirm the change. Your text is preserved; retrying the same submission is safe.'
}
