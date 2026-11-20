import { feedbackFailure } from '../api/errors.ts'

/** Reuse a request key for unchanged retries while this form/action remains mounted. */
export function useFeedbackWrite() {
  let pending: { payload: string; key: string } | null = null

  function headers(body: unknown) {
    const payload = JSON.stringify(body)

    if (pending?.payload !== payload) {
      pending = { payload, key: crypto.randomUUID() }
    }

    return { 'Idempotency-Key': pending.key }
  }

  function complete() {
    pending = null
  }

  return { headers, complete }
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
