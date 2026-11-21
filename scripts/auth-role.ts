import 'dotenv/config'
import { closeDatabase } from '../server/db/index.ts'
import { setUserRole } from '../layers/auth/server/roles.ts'
import { isPrivilegedRole } from '../layers/auth/shared/roles.ts'

const [action, userId, role, ...extra] = process.argv.slice(2)
if (
  (action !== 'grant' && action !== 'revoke') ||
  !userId?.trim() ||
  !role ||
  !isPrivilegedRole(role) ||
  extra.length
) {
  console.error('Usage: pnpm auth:role grant|revoke <user-id> community-manager|administrator')
  process.exitCode = 1
} else {
  try {
    const updated = await setUserRole(userId, role, action === 'grant', null)
    if (!updated) {
      console.error('User not found. The user must sign in before receiving a role.')
      process.exitCode = 1
    } else {
      console.log(`Role ${action === 'grant' ? 'granted' : 'revoked'}.`)
    }
  } catch {
    console.error('Unable to update role. Check database configuration and migrations.')
    process.exitCode = 1
  } finally {
    await closeDatabase()
  }
}
