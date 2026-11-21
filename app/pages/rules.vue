<script setup lang="ts">
import { communitySettings } from '../../shared/community'

const community = communitySettings(useRuntimeConfig().public.community)

useHead({ title: `Community rules · ${community.name} · Opine` })
</script>

<template>
  <main id="main-content" class="content-column rules-column">
    <NuxtLink class="back-link" to="/feedback">← All feedback</NuxtLink>
    <p class="eyebrow">{{ community.name }}</p>
    <h1>Community rules</h1>
    <div class="rules-text">{{ community.rules }}</div>
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
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.75;
}
</style>
