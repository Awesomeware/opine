import assert from 'node:assert/strict'
import { test } from 'node:test'
import { communitySettings, defaultCommunity } from './community.ts'

test('community configuration keeps useful defaults for omitted or non-text environment values', () => {
  assert.deepEqual(communitySettings({ name: '', url: '', rules: '' }), defaultCommunity)
  assert.deepEqual(communitySettings({ name: 123, url: {}, rules: false }), defaultCommunity)
})

test('community configuration preserves plain text and normalizes a web link', () => {
  assert.deepEqual(
    communitySettings({
      name: '  Pinewood Online  ',
      url: ' https://example.test/community ',
      rules: ' Criticism is welcome.\n\n<script>alert("text only")</script> ',
    }),
    {
      name: 'Pinewood Online',
      url: 'https://example.test/community',
      rules: 'Criticism is welcome.\n\n<script>alert("text only")</script>',
    },
  )
})

test('community links exclude executable schemes, relative paths, and embedded credentials', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,test',
    '/community',
    '//example.test',
    'https://user:secret@example.test',
    'not a URL',
  ]) {
    assert.equal(communitySettings({ ...defaultCommunity, url }).url, '')
  }
  assert.equal(
    communitySettings({ ...defaultCommunity, url: 'http://localhost:3001' }).url,
    'http://localhost:3001/',
  )
})
