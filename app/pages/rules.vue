<script setup lang="ts">
import { useCommunity } from '../composables/useCommunity'

const { data: community, pending } = useCommunity()

useHead(() => ({
  title: community.value
    ? `Community rules · ${community.value.name} · Opine`
    : 'Community rules · Opine',
}))
</script>

<template>
  <main id="main-content" class="content-column rules-column" tabindex="-1">
    <NuxtLink class="back-link" to="/feedback">← All feedback</NuxtLink>
    <p v-if="community" class="eyebrow">{{ community.name }}</p>
    <h1>Community rules</h1>
    <p v-if="pending && !community" role="status">Loading community rules…</p>
    <!-- HTML comes only from the server's Markdown renderer, with raw HTML disabled. -->
    <div v-if="community" class="rules-text" v-html="community.rulesHtml" />
  </main>
</template>

<style scoped>
.rules-column {
  max-width: 800px;
}
h1 {
  margin-top: 0;
}
.rules-text {
  overflow-wrap: anywhere;
  line-height: 1.75;
}
.rules-text :deep(h2),
.rules-text :deep(h3) {
  margin: 1.5em 0 0.5em;
}
.rules-text :deep(li) {
  margin-block: 0.4em;
}
.rules-text :deep(pre) {
  overflow-x: auto;
  padding: 1rem;
  background: var(--color-surface);
}
.rules-text :deep(img) {
  max-width: 100%;
  height: auto;
}
.rules-text :deep(table) {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
}
.rules-text :deep(th),
.rules-text :deep(td) {
  border: 1px solid var(--color-border);
  padding: 0.4em 0.75em;
}
</style>
