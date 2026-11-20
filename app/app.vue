<script setup lang="ts">
import AuthControls from '../layers/auth/app/components/AuthControls.vue'
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <NuxtRouteAnnouncer />
    <header class="site-header">
      <NuxtLink class="brand" to="/feedback" aria-label="Opine home">
        <UiBrand />
      </NuxtLink>
      <FeedbackNavigation />
      <AuthControls />
    </header>
    <NuxtPage />
    <footer class="site-footer">Help shape the game with your feedback.</footer>
  </div>
</template>

<style scoped>
.site-shell {
  min-height: 100vh;
}
.site-header {
  display: flex;
  align-items: center;
  gap: 40px;
  max-width: 1180px;
  min-height: 76px;
  margin: auto;
  padding: 0 28px;
  border-bottom: 1px solid var(--color-border);
}
.brand {
  display: inline-flex;
  flex-shrink: 0;
  text-decoration: none;
}
.site-footer {
  max-width: 1124px;
  margin: 0 auto;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 24px;
  border-top: 1px solid var(--color-border);
}
.skip-link {
  position: absolute;
  left: 16px;
  top: -80px;
  background: var(--color-accent);
  color: var(--color-on-action);
  padding: 12px;
  z-index: 10;
}
.skip-link:focus {
  top: 12px;
}
@media (max-width: 760px) {
  .site-header {
    flex-wrap: wrap;
    gap: 12px 20px;
    padding: 12px 20px 0;
  }
  .site-header :deep(nav) {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
