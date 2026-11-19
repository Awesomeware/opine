<script setup lang="ts">
import AuthControls from '../layers/auth/app/components/AuthControls.vue'
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <header>
      <NuxtLink to="/">Opine</NuxtLink>
      <AuthControls />
    </header>
    <NuxtPage />
  </div>
</template>
