// Passed to the built server, so browser tests exercise deployment-time overrides.
export const testCommunity = {
  name: 'Pinewood Online',
  url: 'https://community.example.test/pinewood',
  rules:
    'Criticism and disagreement are welcome.\n\nNo harassment or spam.\n<img src=x onerror="window.rulesExecuted=true">',
}
