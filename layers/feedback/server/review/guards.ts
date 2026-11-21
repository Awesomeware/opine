import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../../../../server/db/index.ts'
import { userRole } from '../../../auth/server/schema.ts'
import { FeedbackWriteError, type FeedbackTransaction } from '../writes.ts'

export async function requireManager(
  actorId: string,
  database: Pick<FeedbackTransaction, 'select'> = getDatabase(),
) {
  const [role] = await database
    .select({ role: userRole.role })
    .from(userRole)
    .where(and(eq(userRole.userId, actorId), eq(userRole.role, 'community-manager')))
  if (!role) throw new FeedbackWriteError(403, 'Community-manager access is required.')
}

export function checkWorkflowVersion(actual: number, supplied: number) {
  if (actual !== supplied)
    throw new FeedbackWriteError(
      409,
      'The official workflow has changed. Review the latest response and status before saving.',
    )
}
