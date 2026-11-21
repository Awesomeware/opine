import { fields, type Validation } from '../input.ts'

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
