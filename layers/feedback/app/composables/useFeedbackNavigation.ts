import { computed, ref, watch } from 'vue'
import { authClient } from '../../../auth/app/auth-client'
import { getAccess } from '../../../auth/app/api/access'
import { useRequestScope } from './useRequestScope'

/** Navigation hints follow the current account; server authorization remains authoritative. */
export function useFeedbackNavigation() {
  const session = authClient.useSession()
  const owner = computed(() => session.value.data?.user.id ?? null)
  const manager = ref(false)
  const administrator = ref(false)
  const scope = useRequestScope()

  watch(
    owner,
    async (id) => {
      const isCurrent = scope.startRequest()
      manager.value = false
      administrator.value = false

      if (!id) {
        return
      }

      try {
        const access = await getAccess()
        if (isCurrent() && owner.value === id && access.user?.id === id) {
          manager.value = access.roles.includes('community-manager')
          administrator.value = access.roles.includes('administrator')
        }
      } catch {
        // Hide privileged links on failure; protected pages offer an explicit retry.
      }
    },
    { immediate: true },
  )

  return { owner, manager, administrator }
}
