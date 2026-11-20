<script setup lang="ts">
const route = useRoute()

useHead({ title: 'Sign in · Opine' })
</script>

<template>
  <main>
    <h1>Sign in</h1>
    <p v-if="route.query.error" role="alert">
      Sign-in was cancelled or could not be completed. Please try again.
    </p>
    <p>Use Sign in with Discord above to continue. You can retry if sign-in was interrupted.</p>
    <NuxtLink to="/">Return home</NuxtLink>
  </main>
</template>
