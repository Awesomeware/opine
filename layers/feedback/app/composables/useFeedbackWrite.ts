import { ref, computed } from 'vue'

// Each mounted form belongs to one account and one operation. Retain the key
// until success so an uncertain response can be retried after a reload.
export function useFeedbackWrite(scope: string) {
  const storageKey = `opine.feedback.pending.${scope}`
  const warning = ref('')
  const pending = ref<{ payload: string; key: string } | null>(null)
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null')
    if (typeof value?.payload === 'string' && typeof value?.key === 'string') {
      JSON.parse(value.payload)
      pending.value = value
    }
  } catch {
    warning.value = 'Browser storage is unavailable. Keep this page open to retry safely.'
  }
  function headers(body: unknown) {
    const payload = JSON.stringify(body)
    if (pending.value?.payload !== payload) pending.value = { payload, key: crypto.randomUUID() }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(pending.value))
    } catch {
      warning.value = 'Browser storage is unavailable. Keep this page open to retry safely.'
    }
    return { 'Idempotency-Key': pending.value.key }
  }
  function complete() {
    pending.value = null
    try {
      sessionStorage.removeItem(storageKey)
    } catch {
      /* The write already succeeded. */
    }
  }
  const pendingBody = computed<unknown>(() =>
    pending.value ? JSON.parse(pending.value.payload) : null,
  )
  return { headers, complete, warning, pendingBody }
}

export function feedbackWriteError(error: unknown) {
  const status = (error as { statusCode?: number }).statusCode
  if (status === 401) return 'Your session has expired. Sign in again to continue.'
  if (status === 403) return 'You do not have permission to make this change.'
  if (status === 404) return 'This feedback is no longer available.'
  if (status === 429) return 'You are posting too quickly. Please wait before trying again.'
  if (status === 400) return 'Check your text and try again.'
  return 'Unable to confirm the change. Your text is preserved; retrying the same submission is safe.'
}
