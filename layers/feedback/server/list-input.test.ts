import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseListInput, parseCommentListInput } from './list-input.ts'

test('list requests bound filters and page sizes and reject malformed cursors', () => {
  const cursor = {
    createdAt: '2026-01-01T12:00:00.123Z',
    id: '00000000-0000-4000-8000-000000000001',
  }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  assert.deepEqual(
    parseListInput({
      q: ' map ',
      status: 'new',
      category: 'general',
      limit: '2',
      cursor: encode(cursor),
    }),
    {
      success: true,
      data: { q: 'map', category: 'general', status: 'new', limit: 2, cursor },
    },
  )
  for (const query of [
    { q: 'a\0b' },
    { cursor: encode({ ...cursor, createdAt: '0000-01-01T00:00:00.000Z' }) },
    { q: ['map', 'combat'] },
    { q: 'x'.repeat(201) },
    { category: '../general' },
    { status: 'hidden' },
    { limit: '0' },
    { limit: '51' },
    { limit: '1.5' },
    { limit: '1e1' },
    { cursor: 'invalid' },
    { cursor: encode({ ...cursor, createdAt: '2026-02-31T12:00:00.123Z' }) },
    { cursor: encode({ ...cursor, id: 'invalid' }) },
    { cursor: 'x'.repeat(257) },
    { sort: 'random' },
  ]) {
    assert.equal(parseListInput(query).success, false)
  }
})

test('discussion filters accept only one declared contribution type and bounded pagination', () => {
  assert.deepEqual(parseCommentListInput({ type: 'question', limit: '2' }), {
    success: true,
    data: { type: 'question', limit: 2, cursor: undefined },
  })
  assert.equal(parseCommentListInput({}).success, true)
  for (const query of [
    { type: ['question', 'suggestion'] },
    { type: 'official' },
    { type: '' },
    { type: null },
    { type: undefined },
    { category: 'general' },
    { limit: '51' },
    { cursor: 'bad' },
  ])
    assert.equal(parseCommentListInput(query).success, false)
})
