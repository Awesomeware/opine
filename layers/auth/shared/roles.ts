export const privilegedRoles = ['community-manager', 'administrator'] as const

export type PrivilegedRole = (typeof privilegedRoles)[number]
export type Role = 'member' | PrivilegedRole

export function isPrivilegedRole(value: unknown): value is PrivilegedRole {
  return privilegedRoles.some((role) => role === value)
}

export function hasRole(roles: readonly Role[], role: Role) {
  return roles.includes(role)
}
