import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateTagInput, validateTagEditInput } from './tag-input.ts'
import { validatePostInput } from './input.ts'
import { validatePostEditInput } from './input.ts'
const id = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
const post = { title: 'Title', description: 'Feedback', categoryId: id }
test('tags validate names and explicit versions without admitting client authority', () => {
  assert.deepEqual(validateTagInput({ name: ' $$$ ' }), { success: true, data: { name: '$$$' } })
  for (const name of ['', ' ', 'x'.repeat(41), '\0'])
    assert.equal(validateTagInput({ name }).success, false)
  assert.equal(validateTagInput({ name: 'Tag', isActive: true }).success, false)
  assert.equal(validateTagEditInput({ name: 'Tag', isActive: false, version: 1 }).success, true)
  for (const version of [0, 1.5, '1', 2147483647])
    assert.equal(validateTagEditInput({ name: 'Tag', isActive: true, version }).success, false)
})
test('tag selection normalizes sets while preserving omitted legacy create and edit inputs', () => {
  const selected = validatePostInput({ ...post, tagIds: [id, id.toLowerCase()] })
  assert.ok(selected.success)
  assert.deepEqual(selected.data.tagIds, [id.toLowerCase()])
  const omitted = validatePostInput(post)
  assert.ok(omitted.success)
  assert.equal('tagIds' in omitted.data, false)
  const edit = validatePostEditInput({ title: 'Title', description: 'Feedback', version: 1 })
  assert.ok(edit.success)
  assert.equal('tagIds' in edit.data, false)
  for (const tagIds of [null, 'tag', ['bad'], Array(101).fill(id)])
    assert.equal(validatePostInput({ ...post, tagIds }).success, false)
  assert.equal(validatePostInput({ ...post, tagIds: [] }).success, true)
})

test('tag icons trim, clear explicitly, preserve omission and reject invalid short text', () => {
  for (const icon of [' 🕹️ ', '👩‍💻', 'a'.repeat(16)]) {
    assert.deepEqual(validateTagInput({ name: 'Tag', icon }), {
      success: true,
      data: { name: 'Tag', icon: icon.trim() },
    })
  }
  for (const icon of ['', ' ', null]) {
    assert.deepEqual(validateTagEditInput({ name: 'Tag', icon, isActive: true, version: 1 }), {
      success: true,
      data: { name: 'Tag', icon: null, isActive: true, version: 1 },
    })
  }
  assert.deepEqual(validateTagEditInput({ name: 'Tag', isActive: true, version: 1 }), {
    success: true,
    data: { name: 'Tag', isActive: true, version: 1 },
  })
  for (const icon of [42, {}, [], 'a'.repeat(17), 'x\0', 'x\ny']) {
    assert.deepEqual(validateTagInput({ name: 'Tag', icon }), {
      success: false,
      fieldErrors: { icon: 'Use up to 16 characters for the tag icon.' },
    })
  }
})
