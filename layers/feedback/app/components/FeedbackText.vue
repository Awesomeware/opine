<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string }>()
const parts = computed(() =>
  props.text.split(/(https?:\/\/[^\s<>]+)/g).map((text) => {
    try {
      const url = new URL(text)
      return { text, href: ['https:', 'http:'].includes(url.protocol) ? url.href : null }
    } catch {
      return { text, href: null }
    }
  }),
)
</script>
<template>
  <p class="feedback-text">
    <template v-for="(part, index) in parts" :key="index"
      ><a v-if="part.href" :href="part.href" rel="nofollow ugc noopener noreferrer">{{
        part.text
      }}</a
      ><template v-else>{{ part.text }}</template></template
    >
  </p>
</template>
<style scoped>
.feedback-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
