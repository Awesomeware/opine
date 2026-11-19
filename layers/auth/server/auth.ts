import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { getDatabase } from '../../../server/db/index.ts'
import * as schema from './schema.ts'
import { logAuthentication } from './logging.ts'

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for authentication.`)
  return value
}

function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer.`)
  return value
}

export function createAuth() {
  const baseURL = required('BETTER_AUTH_URL')
  const url = new URL(baseURL)
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== baseURL) {
    throw new Error('BETTER_AUTH_URL must be an HTTP(S) origin without a trailing slash.')
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('BETTER_AUTH_URL must use HTTPS outside localhost.')
  }
  const secret = required('BETTER_AUTH_SECRET')
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters.')

  return betterAuth({
    appName: 'Opine',
    baseURL,
    secret,
    database: drizzleAdapter(getDatabase(), { provider: 'pg', schema, transaction: true }),
    socialProviders: {
      discord: {
        clientId: required('DISCORD_CLIENT_ID'),
        clientSecret: required('DISCORD_CLIENT_SECRET'),
      },
    },
    account: {
      accountLinking: { enabled: false, disableImplicitLinking: true },
      encryptOAuthTokens: true,
    },
    session: { cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/social': {
          window: positiveInteger('AUTH_SIGN_IN_WINDOW_SECONDS', 60),
          max: positiveInteger('AUTH_SIGN_IN_MAX', 10),
        },
      },
    },
    advanced: { ipAddress: { ipAddressHeaders: ['x-opine-client-ip'] } },
    onAPIError: { errorURL: '/sign-in' },
    logger: { log: logAuthentication },
  })
}

let auth: ReturnType<typeof createAuth> | undefined
export function getAuth() {
  return (auth ??= createAuth())
}
