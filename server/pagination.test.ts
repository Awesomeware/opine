import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cursorFor, paginateRows, parsePaginationInput } from './pagination.ts'

test('pagination preserves cursor format and millisecond timestamps across requests', () => {
  const row = {
    id: '00000000-0000-4000-8000-000000000001',
    createdAt: new Date('2026-01-01T12:00:00.123Z'),
  }
  const cursor = cursorFor(row, true)
  assert.ok(cursor)
  assert.deepEqual(JSON.parse(Buffer.from(cursor, 'base64url').toString()), {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
  })
  assert.deepEqual(parsePaginationInput({ cursor, limit: '50' }), {
    success: true,
    data: { cursor: { id: row.id, createdAt: row.createdAt.toISOString() }, limit: 50 },
  })
  assert.equal(cursorFor(row, false), null)
  assert.equal(cursorFor(undefined, true), null)
})

test('pagination defaults and strict query validation stay consistent for every endpoint', () => {
  assert.deepEqual(parsePaginationInput({}), {
    success: true,
    data: { cursor: undefined, limit: 20 },
  })
  assert.deepEqual(parsePaginationInput({ limit: '1' }), {
    success: true,
    data: { cursor: undefined, limit: 1 },
  })
  for (const query of [
    { limit: '0' },
    { limit: '51' },
    { limit: '1.5' },
    { limit: '1e1' },
    { limit: ['20'] },
    { cursor: ['invalid'] },
    { cursor: 'not-a-cursor' },
    { category: 'general' },
    { type: 'question' },
    { q: 'text' },
  ]) {
    assert.equal(parsePaginationInput(query).success, false)
  }
})

test('pages omit the lookahead row and resume from the last returned row', () => {
  const rows = [1, 2, 3].map((id) => ({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    createdAt: new Date('2026-01-01T12:00:00.123Z'),
  }))
  assert.deepEqual(paginateRows([], 2), { items: [], nextCursor: null })
  assert.deepEqual(paginateRows(rows.slice(0, 2), 2), {
    items: rows.slice(0, 2),
    nextCursor: null,
  })

  const page = paginateRows(rows, 2)
  assert.deepEqual(page.items, rows.slice(0, 2))
  assert.ok(page.nextCursor)
  assert.deepEqual(parsePaginationInput({ cursor: page.nextCursor, limit: '2' }), {
    success: true,
    data: {
      limit: 2,
      cursor: { id: rows[1]!.id, createdAt: rows[1]!.createdAt.toISOString() },
    },
  })
  assert.equal(rows.length, 3)
})
