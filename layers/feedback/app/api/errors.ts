function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Narrow transport errors once; callers decide which workflow state to update. */
export function feedbackFailure(error: unknown) {
  const failure = isRecord(error) ? error : {}
  const data = isRecord(failure.data) ? failure.data : {}
  const details = isRecord(data.data) ? data.data : {}
  const fields = isRecord(details.fieldErrors) ? details.fieldErrors : {}
  const fieldErrors: Record<string, string> = {}

  for (const [field, message] of Object.entries(fields)) {
    if (typeof message === 'string') {
      fieldErrors[field] = message
    }
  }

  return {
    status: typeof failure.statusCode === 'number' ? failure.statusCode : undefined,
    fieldErrors,
  }
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

  return 'Unable to confirm the change. Check the current content before submitting again.'
}
