// Match only known library messages. Never emit provider/adapter error contents.
const categories: Record<string, string> = {
  'Failed to parse state': 'oauth',
  'State not found': 'oauth',
  INVALID_CALLBACK_REQUEST: 'oauth',
  'Failed to validate authorization code': 'oauth',
  'Unable to get user info': 'oauth',
  account_not_linked: 'oauth',
  'Better auth was unable to query your database.\nError: ': 'database',
  'Failed to create verification': 'database',
  'Unable to create OAuth user': 'database',
  'Failed to create session': 'session',
}

export function logAuthentication(level: string, message: string, ...args: unknown[]) {
  const databaseError = args.some(
    (error) => error instanceof Error && error.name === 'DrizzleQueryError',
  )
  const category = databaseError
    ? 'database'
    : Object.hasOwn(categories, message)
      ? categories[message]
      : 'internal'
  const severity = ['error', 'warn', 'info', 'debug'].includes(level) ? level : 'error'
  console.error(`Authentication ${severity}: ${category}.`)
}
