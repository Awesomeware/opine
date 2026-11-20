<script setup lang="ts">
import { authClient } from '../../../../auth/app/auth-client'
const session = authClient.useSession()
const owner = computed(() => session.value.data?.user.id ?? null)
useHead({ title: 'Manage tags · Opine' })
</script>
<template>
  <main id="main-content" class="content-column">
    <h1>Manage tags</h1>
    <p v-if="session.isPending" role="status">Checking your session…</p>
    <FeedbackTagManagement v-else-if="owner" :key="owner" :owner="owner" />
    <p v-else>Sign in with an administrator account to manage tags.</p>
  </main>
</template>
