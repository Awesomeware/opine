<script setup lang="ts">
import FeedbackInbox from '../../subscriptions/components/FeedbackInbox.vue'
import { authClient } from '../../../../auth/app/auth-client'

const session = authClient.useSession()
const owner = computed(() => session.value.data?.user.id ?? null)

useHead({ title: 'Notifications · Opine' })
</script>

<template>
  <main id="main-content" class="content-column">
    <h1>Notifications</h1>
    <p v-if="session.isPending">Checking your session…</p>
    <FeedbackInbox v-else-if="owner" :key="owner" :owner="owner" />
    <p v-else>Sign in to see your notifications.</p>
  </main>
</template>
