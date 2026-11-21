import assert from 'node:assert/strict'
import { test } from 'node:test'
import { commentEditInput } from './comment-editor-input.ts'

test('comment edits omit unchanged or legacy classification and include explicit changes', () => {
  const form = { body: 'Comment', type: 'question' as const, version: 1 }
  const unchanged = commentEditInput(form, 'question')
  assert.ok(unchanged.success)
  assert.equal('type' in unchanged.data, false)

  const legacy = commentEditInput({ ...form, type: '' }, '')
  assert.ok(legacy.success)
  assert.equal('type' in legacy.data, false)

  const changed = commentEditInput(form, 'suggestion')
  assert.ok(changed.success)
  assert.equal(changed.data.type, 'question')
})
