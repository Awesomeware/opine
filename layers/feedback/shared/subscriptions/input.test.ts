import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { validateFollowInput, validateReadInput } from './input.ts'

test('follow and read commands accept only explicit authorized input shapes', () => {
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
})
