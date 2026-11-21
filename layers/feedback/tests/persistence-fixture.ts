import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { eventLog } from '../../../server/events/schema.ts'
import { user } from '../../auth/server/schema.ts'
import {
  feedbackCategory,
  feedbackComment,
  feedbackOfficialResponse,
  feedbackPost,
  feedbackTag,
} from '../server/schema.ts'

export const persistenceContent = {
  title: 'Persistent feedback proposal',
  description: 'Keep combat indicators visible.',
  comment: 'A concrete example of the problem.',
  editedComment: 'A clearer example of the problem.',
  statusResponse: 'We acknowledge the issue.',
  latestResponse: 'We are collecting examples.',
  tagName: 'Persistence tag',
}

export interface PersistenceFixture {
  postId: string
  lockedPostId: string
  lockedAt: string
  archivedPostId: string
  archivedAt: string
  moderationEvents: { id: string; eventType: string; details: Record<string, unknown> }[]
  categoryId: string
  tagId: string
  userIds: string[]
  authorCookie: { name: string; value: string; url: string }
  followerCookie: { name: string; value: string; url: string }
  commentId: string
  statusResponseId: string
  latestResponseId: string
  notificationId: string
}

function manifestPath() {
  const directory = process.env.OPINE_TEST_ARTIFACT_DIR
  if (!directory) throw new Error('Run through pnpm test:e2e for the restart check.')
  return join(directory, 'persistence.json')
}

export async function savePersistenceFixture(fixture: PersistenceFixture) {
  await writeFile(manifestPath(), JSON.stringify(fixture), { mode: 0o600 })
}

export async function readPersistenceFixture(): Promise<PersistenceFixture> {
  if (process.env.OPINE_TEST_PHASE !== 'restart') throw new Error('Run the isolated restart phase.')
  return JSON.parse(await readFile(manifestPath(), 'utf8'))
}

export async function cleanPersistenceFixture(fixture: PersistenceFixture) {
  const database = getDatabase()
  await database.delete(feedbackComment).where(eq(feedbackComment.postId, fixture.postId))
  await database
    .delete(feedbackOfficialResponse)
    .where(eq(feedbackOfficialResponse.postId, fixture.postId))
  await database
    .delete(feedbackPost)
    .where(inArray(feedbackPost.id, [fixture.postId, fixture.lockedPostId, fixture.archivedPostId]))
  await database.delete(feedbackTag).where(eq(feedbackTag.id, fixture.tagId))
  await database.delete(feedbackCategory).where(eq(feedbackCategory.id, fixture.categoryId))
  await database.delete(eventLog).where(inArray(eventLog.actorId, fixture.userIds))
  await database.delete(user).where(inArray(user.id, fixture.userIds))
}
