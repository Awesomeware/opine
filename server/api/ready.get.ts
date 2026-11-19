import { sql } from 'drizzle-orm'
import { getDatabase } from '../db'

export default defineEventHandler(async () => {
  try {
    await getDatabase().execute(sql`select 1`)
    return { status: 'ok' }
  } catch {
    console.error(
      'Database readiness check failed. Check DATABASE_URL and PostgreSQL availability.',
    )
    throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  }
})
