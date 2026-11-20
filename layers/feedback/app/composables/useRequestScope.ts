import { onScopeDispose } from 'vue'

/**
 * Create synchronously within the owning setup/composable scope. Use one instance
 * per independent read stream. Starting a read invalidates its older results;
 * disposal invalidates all results, including writes already sent to the server.
 * This guards local state only: disposal cannot undo a server-side mutation.
 */
export function useRequestScope() {
  let active = true
  let request = 0

  onScopeDispose(() => {
    active = false
    request++
  })

  function startRequest() {
    const current = ++request
    return () => active && current === request
  }

  return { isActive: () => active, startRequest }
}
