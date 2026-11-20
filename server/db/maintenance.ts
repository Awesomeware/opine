import { fileURLToPath } from 'node:url'
import { is, sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDatabase } from './index.ts'
import * as schema from './schema.ts'

export async function migrateDatabase() {
  await migrate(getDatabase(), {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  })
}

// Operator-only: the CLI requires an explicit database name before calling this.
export async function resetDatabase(confirmedName: string) {
  await getDatabase().transaction(async (transaction) => {
    const result = await transaction.execute(sql`select current_database() as name`)
    if (!confirmedName || result.rows[0]?.name !== confirmedName)
      throw new Error('The confirmation must match the connected database name.')
    const tables = Object.values(schema).filter((value) => is(value, PgTable))
    // No CASCADE: an unexpected external reference must fail without deleting its data.
    await transaction.execute(sql`truncate table ${sql.join(tables, sql`, `)} restart identity`)
    await transaction.insert(schema.feedbackCategory).values({
      slug: 'general',
      name: 'General feedback',
    })
  })
}
