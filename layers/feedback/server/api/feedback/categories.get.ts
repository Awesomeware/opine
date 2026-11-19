import { listCategories } from '../../categories.ts'

export default defineEventHandler(async () => ({ categories: await listCategories() }))
