import { listTags } from '../../../posts/tags.ts'
export default defineEventHandler(async () => ({ tags: await listTags() }))
