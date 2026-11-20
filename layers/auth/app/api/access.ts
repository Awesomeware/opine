import type { Role } from '../../shared/roles'

/** Public access contract; callers must still enforce permissions on the server. */
export type Access = { user: { id: string } | null; roles: Role[] }

export function getAccess() {
  return $fetch<Access>('/api/access')
}
