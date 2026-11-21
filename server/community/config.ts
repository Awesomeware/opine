import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import type { CommunitySettings } from '../../shared/community.ts'

// Only operator-owned rules use Markdown; raw HTML and unsafe links stay disabled.
const markdown = new MarkdownIt({ html: false })
let community: CommunitySettings | undefined

/** One configuration snapshot per server process, independent of the application build. */
export function getCommunity() {
  community ??= readCommunity(resolve('config'))
  return community
}

export function readCommunity(directory: string): CommunitySettings {
  // These two small installation files are read before requests are served.
  const settingsText = readFileSync(join(directory, 'community.json'), 'utf8')
  const rules = readFileSync(join(directory, 'rules.md'), 'utf8')
  let settings: unknown
  try {
    settings = JSON.parse(settingsText)
  } catch {
    throw new Error('config/community.json must contain valid JSON.')
  }
  if (
    !settings ||
    typeof settings !== 'object' ||
    !('name' in settings) ||
    typeof settings.name !== 'string' ||
    !settings.name.trim()
  ) {
    throw new Error('config/community.json requires a nonempty name string.')
  }

  const rawUrl = 'url' in settings ? settings.url : ''
  if (typeof rawUrl !== 'string') throw new Error('config/community.json url must be a string.')
  let url = ''
  if (rawUrl.trim()) {
    try {
      const parsed = new URL(rawUrl.trim())
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('Unsupported URL')
      }
      url = parsed.href
    } catch {
      throw new Error('config/community.json url must be an HTTP(S) address without credentials.')
    }
  }

  const footerDisclaimer = 'footerDisclaimer' in settings ? settings.footerDisclaimer : ''
  if (typeof footerDisclaimer !== 'string')
    throw new Error('config/community.json footerDisclaimer must be a string.')

  if (!rules.trim()) throw new Error('config/rules.md must contain community rules.')

  return {
    name: settings.name.trim(),
    url,
    footerDisclaimer: footerDisclaimer.trim(),
    rulesHtml: markdown.render(rules),
  }
}
