import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { validateCategoryCorrectionInput, validateOfficialResponseInput } from './input.ts'

test('official responses require a meaningful explanation and an explicit valid workflow version', () => {
  assert.deepEqual(
    validateOfficialResponseInput({
      body: '  We are reviewing it.  ',
      status: 'reviewing',
      version: 1,
    }),
    { success: true, data: { body: 'We are reviewing it.', status: 'reviewing', version: 1 } },
  )
  assert.deepEqual(validateOfficialResponseInput({ body: 'More detail', version: 2 }), {
    success: true,
    data: { body: 'More detail', version: 2 },
  })
  for (const input of [
    null,
    [],
    { body: '', version: 1 },
    { body: '   ', version: 1 },
    { body: 'x'.repeat(10001), version: 1 },
    { body: 'Valid', version: 0 },
    { body: 'Valid', version: '1' },
    { body: 'Valid', version: 1.1 },
    { body: 'Valid', version: 2147483647 },
    { body: 'Valid', version: 1, status: null },
    { body: 'Valid', version: 1, status: 'unknown' },
    { body: 'Valid', version: 1, authorId: randomUUID() },
  ])
    assert.equal(validateOfficialResponseInput(input).success, false)
})

test('category corrections accept only explicit authorized input shapes', () => {
  const categoryId = randomUUID()
  assert.deepEqual(validateCategoryCorrectionInput({ categoryId, version: 1 }), {
    success: true,
    data: { categoryId, version: 1 },
  })
  for (const input of [
    { categoryId: 'invalid', version: 1 },
    { categoryId, version: -1 },
    { categoryId, version: 1, status: 'planned' },
  ])
    assert.equal(validateCategoryCorrectionInput(input).success, false)
})
