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
