import { fields, validVersion, type Validation } from '../input.ts'

export type TagInput = { name: string; icon?: string | null }
export type TagEditInput = TagInput & { isActive: boolean; version: number }

export function validateTagInput(input: unknown): Validation<TagInput> {
  const value = fields(input, ['name', 'icon'])
  if (!value) return { success: false, fieldErrors: { form: 'Enter a tag name.' } }
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name || name.length > 40 || name.includes('\0'))
    return { success: false, fieldErrors: { name: 'Use 1–40 characters for the tag name.' } }
  if (value.icon !== undefined && value.icon !== null && typeof value.icon !== 'string')
    return { success: false, fieldErrors: { icon: 'Use up to 16 characters for the tag icon.' } }
  const icon = typeof value.icon === 'string' ? value.icon.trim() || null : value.icon
  if (
    icon &&
    (icon.length > 16 ||
      Array.from(icon).some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      ))
  )
    return { success: false, fieldErrors: { icon: 'Use up to 16 characters for the tag icon.' } }
  return { success: true, data: { name, ...(icon !== undefined ? { icon } : {}) } }
}

export function validateTagEditInput(input: unknown): Validation<TagEditInput> {
  const value = fields(input, ['name', 'icon', 'isActive', 'version'])
  if (!value) return { success: false, fieldErrors: { form: 'Invalid tag changes.' } }
  const parsed = validateTagInput({ name: value.name, icon: value.icon })
  if (!parsed.success) return parsed
  if (typeof value.isActive !== 'boolean' || !validVersion(value.version))
    return {
      success: false,
      fieldErrors: { form: 'A valid tag version and availability are required.' },
    }
  return {
    success: true,
    data: { ...parsed.data, isActive: value.isActive, version: value.version },
  }
}
