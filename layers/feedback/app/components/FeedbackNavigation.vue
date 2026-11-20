<script setup lang="ts">
import { authClient } from '../../../auth/app/auth-client'
const session = authClient.useSession()
const route = useRoute()
const owner = computed(() => session.value.data?.user.id ?? null)
const manager = ref(false)
const administrator = ref(false)
let request = 0
watch(
  owner,
  async (id) => {
    const current = ++request
    manager.value = false
    administrator.value = false
    if (!id) return
    try {
      const access = await $fetch<{ user: { id: string } | null; roles: string[] }>('/api/access')
      if (current === request && owner.value === id && access.user?.id === id) {
        manager.value = access.roles.includes('community-manager')
        administrator.value = access.roles.includes('administrator')
      }
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
    <NuxtLink
      to="/feedback"
      :class="{
        active:
          route.path === '/feedback' ||
          (route.path.startsWith('/feedback/') &&
            !['/feedback/notifications', '/feedback/review', '/feedback/tags'].includes(
              route.path,
            )),
      }"
      >Community feedback</NuxtLink
    ><NuxtLink v-if="owner" to="/feedback/notifications">Notifications</NuxtLink
    ><NuxtLink v-if="manager" to="/feedback/review">Review queue</NuxtLink>
    <NuxtLink v-if="administrator" to="/feedback/tags">Manage tags</NuxtLink>
  </nav>
</template>
<style scoped>
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-self: stretch;
}
a {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 14px 0 11px;
  border-bottom: 3px solid transparent;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
}
a:hover {
  color: var(--color-accent);
}
a.active,
a.router-link-exact-active {
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}
</style>
