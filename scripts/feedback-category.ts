import 'dotenv/config'
import { closeDatabase } from '../server/db/index.ts'
import { setCategoryActive, upsertCategory } from '../layers/feedback/server/categories.ts'

const [action, slug, name, sortOrder, ...extra] = process.argv.slice(2)
try {
  if (action === 'upsert' && slug && name && !extra.length) {
    await upsertCategory(slug, name, sortOrder === undefined ? 0 : Number(sortOrder))
    console.log('Category saved. Existing posts retain their category.')
  } else if ((action === 'enable' || action === 'disable') && slug && name === undefined) {
    if (!(await setCategoryActive(slug, action === 'enable')))
      throw new Error('Category not found.')
    console.log('Category updated.')
  } else {
    throw new Error('Invalid arguments.')
  }
} catch {
  console.error(
    'Unable to update category. Check arguments, database configuration, and migrations.',
  )
  console.error(
    'Usage: pnpm feedback:category upsert <slug> <name> [sort-order] | enable|disable <slug>',
  )
  process.exitCode = 1
} finally {
  await closeDatabase()
}
