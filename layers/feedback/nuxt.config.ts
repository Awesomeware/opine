import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  components: [
    'components',
    'posts/components',
    'discussion/components',
    'review/components',
    'subscriptions/components',
  ].map((directory) => ({
    path: fileURLToPath(new URL(`./app/${directory}`, import.meta.url)),
    extensions: ['vue'],
    pathPrefix: false,
  })),
})
