import { isUuid } from './post-input.ts'
import { fields, validVersion, validateBody, type Validation } from './input.ts'
import { isPostStatus, type PostStatus } from './status.ts'
export type OfficialResponseInput = { body: string; status?: PostStatus; version: number }

export type CategoryCorrectionInput = { categoryId: string; version: number }

export function validateOfficialResponseInput(input: unknown): Validation<OfficialResponseInput> {
  const value = fields(input, ['body', 'status', 'version'])
  if (!value || !validVersion(value.version))
    return { success: false, fieldErrors: { form: 'A valid workflow version is required.' } }
  const body = validateBody(value.body)
  if (!body.success) return body
  if ('status' in value && !isPostStatus(value.status))
    return { success: false, fieldErrors: { status: 'Choose a valid status.' } }
  return {
    success: true,
    data: {
      body: body.data.body,
      version: value.version,
      ...(isPostStatus(value.status) ? { status: value.status } : {}),
    },
  }
}

export function validateCategoryCorrectionInput(
  input: unknown,
): Validation<CategoryCorrectionInput> {
  const value = fields(input, ['categoryId', 'version'])
  if (!value || !validVersion(value.version) || !isUuid(value.categoryId))
    return {
      success: false,
      fieldErrors: { form: 'Choose a category and provide a valid workflow version.' },
    }
  return { success: true, data: { categoryId: value.categoryId, version: value.version } }
}

export function validateFollowInput(input: unknown): Validation<{ following: boolean }> {
  const value = fields(input, ['following'])
  return value && typeof value.following === 'boolean'
    ? { success: true, data: { following: value.following } }
    : { success: false, fieldErrors: { following: 'Choose whether to follow this feedback.' } }
}

export function validateReadInput(input: unknown): Validation<{ read: true }> {
  const value = fields(input, ['read'])
  return value?.read === true
    ? { success: true, data: { read: true } }
    : { success: false, fieldErrors: { read: 'Mark this notification as read.' } }
}
