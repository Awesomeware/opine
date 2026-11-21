import { and, eq } from 'drizzle-orm'
import { getDatabase } from '../../../server/db/index.ts'
import { isPrivilegedRole, type PrivilegedRole, type Role } from '../shared/roles.ts'
import { user, userRole } from './schema.ts'

export async function getUserRoles(userId: string): Promise<Role[]> {
  const rows = await getDatabase()
    .select({ role: userRole.role })
    .from(user)
    .leftJoin(userRole, eq(user.id, userRole.userId))
    .where(eq(user.id, userId))

  if (!rows.length) return []
  return ['member', ...rows.flatMap(({ role }) => (role ? [role] : []))]
}

// The HTTP boundary or trusted operator authorizes this operation.
// Returns false when the target user does not exist.
export async function setUserRole(userId: string, role: PrivilegedRole, grant: boolean) {
  if (!isPrivilegedRole(role)) throw new Error('Invalid privileged role.')

  return getDatabase().transaction(async (transaction) => {
    const [target] = await transaction.select({ id: user.id }).from(user).where(eq(user.id, userId))
    if (!target) return false

    if (grant) {
      await transaction.insert(userRole).values({ userId, role }).onConflictDoNothing()
    } else {
      await transaction
        .delete(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.role, role)))
    }

    return true
  })
}
