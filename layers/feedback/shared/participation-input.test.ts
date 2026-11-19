import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateCommentInput,
  validateCommentEditInput,
  validatePostEditInput,
  validateReactionInput,
} from './participation-input.ts'

test('participation input trims content and rejects forged fields, invalid versions and oversized comments', () => {
  assert.deepEqual(validateCommentInput({ body: '  Useful feedback  ' }), {
    success: true,
    data: { body: 'Useful feedback' },
  })
  for (const input of [
    { body: '' },
    { body: 'a'.repeat(10001) },
    { body: 'bad\0text' },
    { body: 'ok', authorId: 'forged' },
    null,
  ])
    assert.equal(validateCommentInput(input).success, false)
  assert.equal(validateCommentInput({ body: 'a'.repeat(10000) }).success, true)
  for (const version of [0, -1, 1.5, '1', 2147483647, undefined])
    assert.equal(validateCommentEditInput({ body: 'updated', version }).success, false)
  assert.deepEqual(validateCommentEditInput({ body: ' updated ', version: 2 }), {
    success: true,
    data: { body: 'updated', version: 2 },
  })
  const edit = { title: ' Title ', description: ' Feedback ', desiredImprovement: '', version: 1 }
  assert.deepEqual(validatePostEditInput(edit), {
    success: true,
    data: { title: 'Title', description: 'Feedback', desiredImprovement: null, version: 1 },
  })
  for (const extra of [{ categoryId: 'forged' }, { status: 'delivered' }, { authorId: 'forged' }])
    assert.equal(validatePostEditInput({ ...edit, ...extra }).success, false)
  for (const kind of ['agree', 'disagree', null])
    assert.deepEqual(validateReactionInput({ kind }), { success: true, data: { kind } })
  for (const input of [{ kind: 'support' }, {}, { kind: null, userId: 'forged' }])
    assert.equal(validateReactionInput(input).success, false)
})
