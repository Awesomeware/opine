import { and, asc, eq, inArray } from 'drizzle-orm'
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

type RoleTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>['transaction']>[0]>[0]

async function changeRole(
  transaction: RoleTransaction,
  userId: string,
  role: PrivilegedRole,
  grant: boolean,
) {
  if (grant) {
    await transaction.insert(userRole).values({ userId, role }).onConflictDoNothing()
  } else {
    await transaction
      .delete(userRole)
      .where(and(eq(userRole.userId, userId), eq(userRole.role, role)))
  }
}

// Operator-only mutation. HTTP callers use setUserRoleAsAdministrator instead.
// Returns false when the target user does not exist.
export async function setUserRole(userId: string, role: PrivilegedRole, grant: boolean) {
  if (!isPrivilegedRole(role)) throw new Error('Invalid privileged role.')

  return getDatabase().transaction(async (transaction) => {
    const [target] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('update')
    if (!target) return false
    await changeRole(transaction, userId, role, grant)
    return true
  })
}

/** Authorize the authenticated actor at the same serialization point as the role change. */
export async function setUserRoleAsAdministrator(
  actorId: string,
  userId: string,
  role: PrivilegedRole,
  grant: boolean,
) {
  if (!isPrivilegedRole(role)) throw new Error('Invalid privileged role.')

  return getDatabase().transaction(async (transaction) => {
    // One order prevents cross-administrator deadlocks; NO KEY UPDATE allows
    // unrelated notification foreign keys to reference these accounts.
    const users = await transaction
      .select({ id: user.id })
      .from(user)
      .where(inArray(user.id, [...new Set([actorId, userId])]))
      .orderBy(asc(user.id))
      .for('no key update')
    const [administrator] = await transaction
      .select({ id: userRole.userId })
      .from(userRole)
      .where(and(eq(userRole.userId, actorId), eq(userRole.role, 'administrator')))
    if (!administrator) return 'forbidden' as const
    if (!users.some((target) => target.id === userId)) return 'not-found' as const
    await changeRole(transaction, userId, role, grant)
    return 'updated' as const
  })
}
