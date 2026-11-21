import { listCategories } from '../../posts/categories.ts'

export default defineEventHandler(async () => ({ categories: await listCategories() }))
