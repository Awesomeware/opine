<script setup lang="ts">
import AuthControls from '../layers/auth/app/components/AuthControls.vue'
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <NuxtRouteAnnouncer />
    <header class="site-header">
      <NuxtLink class="brand" to="/feedback" aria-label="Opine home">
        <svg viewBox="0 0 76 54" aria-hidden="true">
          <circle cx="20" cy="31" r="14" fill="none" stroke="currentColor" stroke-width="5" />
          <path d="M55 3 40 24h8L36 40h15v11h8V40h15L62 24h8Z" fill="currentColor" />
        </svg>
        <span>Opine</span>
      </NuxtLink>
      <nav aria-label="Main"><NuxtLink to="/feedback">Community feedback</NuxtLink></nav>
      <AuthControls />
    </header>
    <NuxtPage />
    <footer class="site-footer">Help shape the game with your feedback.</footer>
  </div>
</template>
