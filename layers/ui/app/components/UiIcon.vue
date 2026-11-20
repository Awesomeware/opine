<script setup lang="ts">
defineProps<{
  name:
    | 'agree'
    | 'disagree'
    | 'link'
    | 'context'
    | 'different-view'
    | 'suggestion'
    | 'question'
    | 'search'
}>()

const paths = {
  agree: 'M7 10v11H3V10h4Zm0 1 5-8c2 0 2 2 1 6h6a2 2 0 0 1 2 2l-2 8a2 2 0 0 1-2 2H7',
  disagree: 'M7 14V3H3v11h4Zm0-1 5 8c2 0 2-2 1-6h6a2 2 0 0 0 2-2l-2-8a2 2 0 0 0-2-2H7',
  link: 'm10 13 4-4M8 15l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 8a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2',
  context: 'M21 11a8 8 0 0 1-8 8H8l-5 3 1-6a8 8 0 1 1 17-5Z',
  'different-view': 'M12 3v18M6 21h12M4 7h16M5 7l-4 8h8L5 7Zm14 0-4 8h8l-4-8Z',
  suggestion: 'M9 18h6m-6 3h6M8 15c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7v1H8v-1Z',
  question: 'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  search: 'm21 21-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
}
</script>
<template>
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
<style scoped>
.ui-icon {
  width: 1.15em;
  height: 1.15em;
  flex-shrink: 0;
  vertical-align: -0.2em;
}
</style>
