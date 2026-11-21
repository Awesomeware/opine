import { isUuid, fields, validVersion, validateBody, type Validation } from '../input.ts'
import { isPostStatus, type PostStatus } from '../status.ts'
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
