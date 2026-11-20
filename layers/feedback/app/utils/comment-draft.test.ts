import assert from 'node:assert/strict'
import test from 'node:test'
import { parseComposerDraft } from './comment-draft.ts'

test('legacy comment drafts preserve their exact text, including JSON-looking content', () => {
  for (const body of [
    '',
    '  Plain text\nwith spacing  ',
    '123',
    'null',
    'true',
    '"quoted"',
    '["context"]',
    '{"other":"field"}',
    '{"body":123,"type":"question"}',
    '{unfinished',
  ]) {
    assert.deepEqual(parseComposerDraft(body), { body, type: '' })
  }
})

test('structured comment drafts restore checked text and contribution type', () => {
  assert.deepEqual(parseComposerDraft('{"body":"  My question  ","type":"question"}'), {
    body: '  My question  ',
    type: 'question',
  })
  assert.deepEqual(parseComposerDraft('{"body":"Draft without a selection"}'), {
    body: 'Draft without a selection',
    type: '',
  })
  assert.deepEqual(parseComposerDraft('{"body":"Draft","type":"unknown"}'), {
    body: 'Draft',
    type: '',
  })
})
