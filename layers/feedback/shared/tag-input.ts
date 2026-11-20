export type TagInput = { name: string }
export type TagEditInput = TagInput & { isActive: boolean; version: number }
type Validation<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> }
export function validateTagInput(input: unknown): Validation<TagInput> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== 'name')
  )
    return { success: false, fieldErrors: { form: 'Enter a tag name.' } }
  const value = input as Record<string, unknown>
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name || name.length > 40 || name.includes('\0'))
    return { success: false, fieldErrors: { name: 'Use 1–40 characters for the tag name.' } }
  return { success: true, data: { name } }
}
export function validateTagEditInput(input: unknown): Validation<TagEditInput> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !['name', 'isActive', 'version'].includes(key))
  )
    return { success: false, fieldErrors: { form: 'Invalid tag changes.' } }
  const value = input as Record<string, unknown>
  const parsed = validateTagInput({ name: value.name })
  if (!parsed.success) return parsed
  if (
    typeof value.isActive !== 'boolean' ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1 ||
    value.version >= 2147483647
  )
    return {
      success: false,
      fieldErrors: { form: 'A valid tag version and availability are required.' },
    }
  return {
    success: true,
    data: { ...parsed.data, isActive: value.isActive, version: value.version },
  }
}
