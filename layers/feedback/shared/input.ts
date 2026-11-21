export type Validation<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> }

export function fields(input: unknown, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  return Object.keys(value).every((key) => allowed.includes(key)) ? value : null
}

export function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 2147483647
}

export const commentLimit = 10_000

export function validateBody(value: unknown): Validation<{ body: string }> {
  const body = typeof value === 'string' ? value.trim() : ''
  if (!body || body.length > commentLimit || body.includes('\0'))
    return {
      success: false,
      fieldErrors: { body: 'Enter a comment in 1–10000 characters without null characters.' },
    }
  return { success: true, data: { body } }
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}
