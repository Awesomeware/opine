export const defaultCommunity = {
  name: 'Community',
  url: '',
  rules: `Criticism, disagreement, and negative feedback about the game are welcome. Explain what you think and why; negative sentiment alone is not grounds for moderation.

Discuss ideas and the game, not other people's worth. Harassment, threats, hate speech, and sharing someone's private information are not allowed.

Keep contributions relevant and avoid spam. Community managers may lock or archive posts that break these rules.`,
}

/** Resolve public installation settings; Nuxt may parse environment values as JSON. */
export function communitySettings(config: { name: unknown; url: unknown; rules: unknown }) {
  const name = typeof config.name === 'string' ? config.name.trim() : ''
  const rules = typeof config.rules === 'string' ? config.rules.trim() : ''

  return {
    name: name || defaultCommunity.name,
    rules: rules || defaultCommunity.rules,
    url: communityUrl(config.url),
  }
}

function communityUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return ''

  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return ''
    return url.href
  } catch {
    return ''
  }
}
