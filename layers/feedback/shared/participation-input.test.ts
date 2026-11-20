import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  validateCommentInput,
  validateCommentEditInput,
  validatePostEditInput,
  validateReactionInput,
} from './participation-input.ts'

test('participation input trims content and rejects forged fields, invalid versions and oversized comments', () => {
  assert.deepEqual(validateCommentInput({ body: '  Useful feedback  ', type: 'context' }), {
    success: true,
    data: { body: 'Useful feedback', type: 'context' },
  })
  for (const body of ['', 'a'.repeat(10001), 'bad\0text']) {
    const result = validateCommentInput({ body, type: 'context' })
    assert.equal(result.success, false)
    if (!result.success) assert.deepEqual(Object.keys(result.fieldErrors), ['body'])
  }
  for (const input of [{ body: 'ok', type: 'context', authorId: 'forged' }, null]) {
    const result = validateCommentInput(input)
    assert.equal(result.success, false)
    if (!result.success) assert.ok(result.fieldErrors.form)
  }
  assert.equal(validateCommentInput({ body: 'a'.repeat(10000), type: 'context' }).success, true)
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

test('contribution types require an explicit choice while legacy edits preserve omission', () => {
  for (const type of ['context', 'different_view', 'suggestion', 'question']) {
    assert.deepEqual(validateCommentInput({ body: ' Details ', type }), {
      success: true,
      data: { body: 'Details', type },
    })
    assert.deepEqual(validateCommentEditInput({ body: ' Details ', type, version: 1 }), {
      success: true,
      data: { body: 'Details', type, version: 1 },
    })
  }
  assert.equal(validateCommentInput({ body: 'Details' }).success, false)
  for (const type of [null, undefined, '', 'official', ['question']]) {
    assert.equal(validateCommentInput({ body: 'Details', type }).success, false)
    assert.equal(validateCommentEditInput({ body: 'Details', type, version: 1 }).success, false)
  }
  assert.deepEqual(validateCommentEditInput({ body: 'Details', version: 1 }), {
    success: true,
    data: { body: 'Details', version: 1 },
  })
})
