import { fields, validVersion, validateBody, type Validation } from '../input.ts'
import { isPostStatus, type PostStatus } from '../status.ts'
export type OfficialResponseInput = { body: string; status?: PostStatus; version: number }

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
