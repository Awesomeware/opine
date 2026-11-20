import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parsePostDraft,
  parseCommentDraft,
  parseSubmissionDraft,
  postEditInput,
  commentEditInput,
  submissionInput,
} from './editor-input.ts'

const tagId = '00000000-0000-4000-8000-000000000001'
const post = {
  title: 'Title',
  description: 'Feedback',
  desiredImprovement: '',
  tagIds: [],
  version: 1,
}

test('stored drafts only restore valid understood fields', () => {
  for (const value of [null, [], 'text', { version: '1' }, { version: -1 }]) {
    assert.deepEqual(parsePostDraft(value), {})
    assert.deepEqual(parseCommentDraft(value), {})
  }
  assert.deepEqual(
    parsePostDraft({ version: 2, title: 'Draft', categoryId: 'unexpected', tagIds: [3] }),
    {
      version: 2,
      title: 'Draft',
    },
  )
  assert.deepEqual(parseCommentDraft({ version: 2, body: 'Draft', type: 'made-up' }), {
    version: 2,
    body: 'Draft',
  })
  assert.deepEqual(parseSubmissionDraft({ title: 'Draft', description: 1, tagIds: [tagId] }), {
    title: 'Draft',
    tagIds: [tagId],
  })
})

test('post edits distinguish omitted tags, explicit clearing, and uncertain tagged writes', () => {
  const unchanged = postEditInput(post, [], null)
  assert.ok(unchanged.success)
  assert.equal('tagIds' in unchanged.data, false)

  const cleared = postEditInput(post, [tagId], null)
  assert.ok(cleared.success)
  assert.deepEqual(cleared.data.tagIds, [])

  const replay = postEditInput(post, [], { tagIds: [] })
  assert.ok(replay.success)
  assert.deepEqual(replay.data.tagIds, [])
  assert.deepEqual(postEditInput(post, [], ['invalid']), unchanged)
})

test('comment edits preserve omitted classification until explicitly changed', () => {
  const form = { body: 'Comment', type: 'question' as const, version: 1 }
  const unchanged = commentEditInput(form, 'question', null)
  assert.ok(unchanged.success)
  assert.equal('type' in unchanged.data, false)

  for (const pending of [{ type: 'question' }]) {
    const replay = commentEditInput(form, 'question', pending)
    assert.ok(replay.success)
    assert.equal(replay.data.type, 'question')
  }
  const changed = commentEditInput(form, 'suggestion', null)
  assert.ok(changed.success)
  assert.equal(changed.data.type, 'question')
})

test('new submissions retain legacy omission only when recovering an uncertain write', () => {
  const form = {
    title: 'Title',
    description: 'Feedback',
    desiredImprovement: '',
    tagIds: [],
    categoryId: tagId,
  }
  const legacy = submissionInput(form, { title: 'Title' })
  assert.ok(legacy.success)
  assert.equal('tagIds' in legacy.data, false)

  const current = submissionInput(form, null)
  assert.ok(current.success)
  assert.deepEqual(current.data.tagIds, [])

  const changed = submissionInput({ ...form, tagIds: [tagId] }, { title: 'Title' })
  assert.ok(changed.success)
  assert.deepEqual(changed.data.tagIds, [tagId])
})
