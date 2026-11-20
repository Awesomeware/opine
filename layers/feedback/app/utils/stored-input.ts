export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Stored data is untrusted and may come from an older application version. */
export function readStoredValue(
  key: string,
): { success: true; value: unknown } | { success: false } {
  try {
    const value = sessionStorage.getItem(key)
    return { success: true, value: value === null ? null : JSON.parse(value) }
  } catch {
    return { success: false }
  }
}

export function writeStoredValue(key: string, value: unknown): boolean {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** Failure to clear browser storage must not turn a committed write into a failure. */
export function removeStoredValue(key: string): boolean {
  try {
    sessionStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
