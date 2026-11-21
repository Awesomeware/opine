<script setup lang="ts">
import FeedbackNavigation from '../layers/feedback/app/components/FeedbackNavigation.vue'
import AuthControls from '../layers/auth/app/components/AuthControls.vue'
import { useCommunity } from './composables/useCommunity'

const { data: community, error: communityError, refresh: refreshCommunity } = useCommunity()
const route = useRoute()

// Page navigation starts at the new content; query filters keep their current focus.
watch(
  () => route.path,
  async () => {
    await nextTick()
    document.getElementById('main-content')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main-content">Skip to content</a>
    <NuxtRouteAnnouncer />
    <header class="site-header">
      <div class="identity">
        <NuxtLink class="brand" to="/feedback" aria-label="Opine home">
          <UiBrand />
        </NuxtLink>
        <span v-if="community" class="community-name">{{ community.name }}</span>
      </div>
      <FeedbackNavigation />
      <AuthControls />
    </header>
    <NuxtPage />
    <footer class="site-footer">
      <span>Help shape the game with your feedback.</span>
      <nav aria-label="Community">
        <NuxtLink to="/rules">Community rules</NuxtLink>
        <a v-if="community?.url" :href="community.url">Visit {{ community.name }}</a>
      </nav>
      <p v-if="community?.footerDisclaimer" class="footer-disclaimer">
        {{ community.footerDisclaimer }}
      </p>
      <p v-if="communityError" role="alert">
        Unable to load community settings.
        <UiButton variant="quiet" @click="refreshCommunity()">Retry community settings</UiButton>
      </p>
    </footer>
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
.identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  max-width: 240px;
  padding: 12px 0;
}
.community-name {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
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
.site-footer nav {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 24px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}
.footer-disclaimer {
  max-width: 80ch;
  margin: 16px auto 0;
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
