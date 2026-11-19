<script setup lang="ts">
import { authClient } from '../../../../auth/app/auth-client'
const session = authClient.useSession()
const owner = computed(() => session.value.data?.user.id ?? null)
useHead({ title: 'Review queue · Opine' })
</script>
<template>
  <main id="main-content" class="content-column">
    <h1>Review queue</h1>
    <p v-if="session.isPending">Checking your session…</p>
    <FeedbackReviewQueue v-else-if="owner" :key="owner" />
    <p v-else>Sign in with a community-manager account to review feedback.</p>
  </main>
</template>
