import { listTags } from '../../../tags.ts'
export default defineEventHandler(async () => ({ tags: await listTags() }))
