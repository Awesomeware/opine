import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logAuthentication } from './logging.ts'

test('auth diagnostics distinguish failures without exposing provider or database data', (t) => {
  const output: unknown[][] = []
  t.mock.method(console, 'error', (...args: unknown[]) => output.push(args))
  const databaseError = new Error('query with a private email and secret token')
  databaseError.name = 'DrizzleQueryError'
  logAuthentication('error', 'State not found', { token: 'secret token' })
  logAuthentication('error', 'INTERNAL_SERVER_ERROR', databaseError)
  logAuthentication('warn', 'Failed to create session', 'private user data')
  logAuthentication('error', 'unrecognized message with a secret token', databaseError.cause)
  assert.deepEqual(output, [
    ['Authentication error: oauth.'],
    ['Authentication error: database.'],
    ['Authentication warn: session.'],
    ['Authentication error: internal.'],
  ])
})
