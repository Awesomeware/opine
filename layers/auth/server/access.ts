import { getAuth } from './auth.ts'
import { getUserRoles } from './roles.ts'

// Public server entrypoint for features: resolve identity from the signed session,
// then read current roles. Never accept an actor ID or roles from client input.
export async function getAccess(headers: Headers) {
  const session = await getAuth().api.getSession({ headers })
  if (!session) return null
  return {
    user: { id: session.user.id, name: session.user.name },
    roles: await getUserRoles(session.user.id),
  }
}
