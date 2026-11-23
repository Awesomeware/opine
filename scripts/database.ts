import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { closeDatabase, getDatabase } from '../server/db/index.ts'
import { migrateDatabase, resetDatabase } from '../server/db/maintenance.ts'
import { seedExampleData } from '../layers/feedback/server/example-data.ts'

const [action, flag, confirmation, ...extra] = process.argv.slice(2)
const validArguments =
  (action === 'seed' && flag === undefined) ||
  (action === 'reset' && flag === '--confirm' && !!confirmation && extra.length === 0)

try {
  if (!validArguments) {
    console.error('Usage: pnpm db:seed | pnpm db:reset --confirm <database-name>')
    console.error(
      'Reset deletes all Opine data, including accounts, sessions, roles, and feedback.',
    )
    process.exitCode = 1
  } else {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw new Error('Invalid URL.')
    const name = decodeURIComponent(target.pathname.slice(1))
    if (!name) throw new Error('A database name is required.')
    // Reject a mistaken target before migrations or any data changes.
    if (action === 'reset' && confirmation !== name) {
      console.error(
        'Confirmation does not match the database name in DATABASE_URL. Nothing changed.',
      )
      process.exitCode = 1
    } else {
      console.log(
        `Database: ${JSON.stringify(name)} at ${JSON.stringify(target.hostname)}:${target.port || '5432'}`,
      )
      if (action === 'reset') {
        const actual = await getDatabase().execute(sql`select current_database() as name`)
        if (actual.rows[0]?.name !== confirmation)
          throw new Error('The connected database does not match the confirmation.')
      }
      await migrateDatabase()
      if (action === 'seed') {
        const { createdPosts } = await seedExampleData()
        console.log(
          createdPosts
            ? `Added ${createdPosts} example feedback posts. Open /feedback to browse them.`
            : 'Example feedback is already present. Existing content was preserved.',
        )
      } else {
        await resetDatabase(confirmation!)
        console.log(
          'All Opine data removed. Default tags are ready. Sign in again and reassign roles as needed.',
        )
        console.log('Run pnpm db:seed to add example feedback.')
      }
    }
  }
} catch {
  console.error(
    'Database command failed. Check DATABASE_URL, PostgreSQL availability, and migrations.',
  )
  process.exitCode = 1
} finally {
  await closeDatabase()
}
