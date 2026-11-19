<script setup lang="ts">
import { authClient } from '../../../auth/app/auth-client'
const session = authClient.useSession()
const owner = computed(() => session.value.data?.user.id ?? null)
const manager = ref(false)
let request = 0
watch(
  owner,
  async (id) => {
    const current = ++request
    manager.value = false
    if (!id) return
    try {
      const access = await $fetch<{ user: { id: string } | null; roles: string[] }>('/api/access')
      if (current === request && owner.value === id && access.user?.id === id)
        manager.value = access.roles.includes('community-manager')
    } catch {
      /* Protected pages can retry access checks. */
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  request++
})
</script>
<template>
  <nav aria-label="Main">
    <NuxtLink to="/feedback">Community feedback</NuxtLink
    ><NuxtLink v-if="owner" to="/feedback/notifications">Notifications</NuxtLink
    ><NuxtLink v-if="manager" to="/feedback/review">Review queue</NuxtLink>
  </nav>
</template>
<style scoped>
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
</style>
