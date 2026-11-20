import assert from 'node:assert/strict'
import { test } from 'node:test'
import { postEditInput, commentEditInput } from './editor-input.ts'

const tagId = '00000000-0000-4000-8000-000000000001'
const post = {
  title: 'Title',
  description: 'Feedback',
  desiredImprovement: '',
  tagIds: [],
  version: 1,
}

test('post edits preserve unchanged tags and explicitly clear removed tags', () => {
  const unchanged = postEditInput({ ...post, tagIds: [tagId] }, [tagId])
  assert.ok(unchanged.success)
  assert.equal('tagIds' in unchanged.data, false)

  const cleared = postEditInput(post, [tagId])
  assert.ok(cleared.success)
  assert.deepEqual(cleared.data.tagIds, [])

  const added = postEditInput({ ...post, tagIds: [tagId] }, [])
  assert.ok(added.success)
  assert.deepEqual(added.data.tagIds, [tagId])
})

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
