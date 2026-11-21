import { getDatabase } from '../../../server/db/index.ts'

export type FeedbackTransaction = Parameters<
  Parameters<ReturnType<typeof getDatabase>['transaction']>[0]
>[0]
export class FeedbackWriteError extends Error {
  statusCode: number
  retryAfterSeconds?: number
  constructor(statusCode: number, message: string, retryAfterSeconds?: number) {
    super(message)
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}
export function positiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1 || value > 86400)
    throw new Error(`${name} must be an integer between 1 and 86400.`)
  return value
}
