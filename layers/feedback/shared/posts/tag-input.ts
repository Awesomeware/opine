import { fields, validVersion, type Validation } from '../input.ts'

export type TagInput = { name: string }
export type TagEditInput = TagInput & { isActive: boolean; version: number }

export function validateTagInput(input: unknown): Validation<TagInput> {
  const value = fields(input, ['name'])
  if (!value) return { success: false, fieldErrors: { form: 'Enter a tag name.' } }
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  if (!name || name.length > 40 || name.includes('\0'))
    return { success: false, fieldErrors: { name: 'Use 1–40 characters for the tag name.' } }
  return { success: true, data: { name } }
}

export function validateTagEditInput(input: unknown): Validation<TagEditInput> {
  const value = fields(input, ['name', 'isActive', 'version'])
  if (!value) return { success: false, fieldErrors: { form: 'Invalid tag changes.' } }
  const parsed = validateTagInput({ name: value.name })
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
