import assert from 'node:assert/strict'
import { test } from 'node:test'
import { postLimits, validatePostInput } from './post-input.ts'

const input = {
  title: ' A better map ',
  description: ' I get lost. ',
  desiredImprovement: '  ',
  categoryId: '00000000-0000-4000-8000-000000000001',
}

test('feedback input normalizes optional text and rejects malformed or forged fields', () => {
  assert.deepEqual(validatePostInput(input), {
    success: true,
    data: { ...input, title: 'A better map', description: 'I get lost.', desiredImprovement: null },
  })
  for (const value of [
    null,
    [],
    'text',
    { ...input, title: '\n\t' },
    { ...input, description: 123 },
    { ...input, desiredImprovement: {} },
    { ...input, categoryId: 'not-a-uuid' },
    { ...input, authorId: 'someone-else' },
    { ...input, status: 'planned' },
  ]) {
    assert.equal(validatePostInput(value).success, false)
  }
  for (const field of ['title', 'description', 'desiredImprovement'] as const) {
    assert.equal(validatePostInput({ ...input, [field]: 'a\0b' }).success, false)
    assert.equal(
      validatePostInput({ ...input, [field]: 'a'.repeat(postLimits[field]) }).success,
      true,
    )
    const result = validatePostInput({ ...input, [field]: 'a'.repeat(postLimits[field] + 1) })
    assert.equal(result.success, false)
    if (!result.success) assert.ok(result.fieldErrors[field])
  }
})
