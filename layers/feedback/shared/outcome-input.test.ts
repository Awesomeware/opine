import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import {
  validateCategoryCorrectionInput,
  validateFollowInput,
  validateOfficialResponseInput,
  validateReadInput,
} from './outcome-input.ts'

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

test('follow, read, and category commands accept only explicit authorized input shapes', () => {
  for (const following of [true, false])
    assert.deepEqual(validateFollowInput({ following }), { success: true, data: { following } })
  for (const input of [null, {}, { following: 'true' }, { following: true, userId: randomUUID() }])
    assert.equal(validateFollowInput(input).success, false)
  assert.deepEqual(validateReadInput({ read: true }), { success: true, data: { read: true } })
  for (const input of [
    null,
    {},
    { read: false },
    { read: 'true' },
    { read: true, userId: randomUUID() },
  ])
    assert.equal(validateReadInput(input).success, false)
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
