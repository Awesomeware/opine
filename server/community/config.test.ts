import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { readCommunity } from './config.ts'

async function configuration(
  t: TestContext,
  settings: unknown,
  rules = '## Be constructive\n\nCriticism is welcome.',
) {
  const directory = await mkdtemp(join(tmpdir(), 'opine-community-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await writeFile(join(directory, 'community.json'), JSON.stringify(settings))
  await writeFile(join(directory, 'rules.md'), rules)
  return directory
}

test('installation files expose only public settings and render Markdown structure', async (t) => {
  const directory = await configuration(
    t,
    {
      name: ' 1984 ',
      url: ' https://example.test/community ',
      footerDisclaimer: ' Independent community. ',
      extra: 'not public',
    },
    '## Discussion\n\n**Criticism** is welcome.\n\n- Stay relevant\n- [Community](https://example.test)',
  )
  const community = readCommunity(directory)
  assert.deepEqual(Object.keys(community).sort(), ['footerDisclaimer', 'name', 'rulesHtml', 'url'])
  assert.equal(community.name, '1984')
  assert.equal(community.url, 'https://example.test/community')
  assert.equal(community.footerDisclaimer, 'Independent community.')
  assert.match(community.rulesHtml, /<h2>Discussion<\/h2>/)
  assert.match(community.rulesHtml, /<strong>Criticism<\/strong>/)
  assert.match(community.rulesHtml, /<ul>/)
  assert.match(community.rulesHtml, /<a href="https:\/\/example.test">Community<\/a>/)
})

test('rules escape embedded HTML and reject executable Markdown links', async (t) => {
  const directory = await configuration(
    t,
    { name: 'Community' },
    '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n[encoded](jav&#x61;script:alert%281%29)\n\n![bad image](javascript:alert%281%29)',
  )
  const { rulesHtml, url, footerDisclaimer } = readCommunity(directory)
  assert.equal(url, '')
  assert.equal(footerDisclaimer, '')
  assert.match(rulesHtml, /&lt;script&gt;/)
  assert.match(rulesHtml, /&lt;img/)
  assert.doesNotMatch(rulesHtml, /<script|<img|<a\s/i)
})

test('invalid names, URLs, JSON and missing or empty rules report configuration errors', async (t) => {
  const directory = await configuration(t, { name: 'Community', url: '' })
  for (const settings of [
    { name: '' },
    { name: 1984 },
    { name: 'Community', url: 'javascript:alert(1)' },
    { name: 'Community', url: 'https://user:secret@example.test' },
    { name: 'Community', url: '/relative' },
    { name: 'Community', footerDisclaimer: 42 },
  ]) {
    await writeFile(join(directory, 'community.json'), JSON.stringify(settings))
    assert.throws(() => readCommunity(directory), /community.json/)
  }
  await writeFile(join(directory, 'community.json'), '{ invalid JSON')
  assert.throws(() => readCommunity(directory), /community.json/)
  await writeFile(join(directory, 'community.json'), JSON.stringify({ name: 'Community' }))
  await writeFile(join(directory, 'rules.md'), '  \n')
  assert.throws(() => readCommunity(directory), /rules.md/)
  await rm(join(directory, 'rules.md'))
  assert.throws(() => readCommunity(directory), /rules.md/)
})
