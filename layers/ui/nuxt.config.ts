import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  css: [
    fileURLToPath(new URL('./app/assets/css/tokens.css', import.meta.url)),
    fileURLToPath(new URL('./app/assets/css/base.css', import.meta.url)),
  ],
  components: [
    {
      path: fileURLToPath(new URL('./app/components', import.meta.url)),
      extensions: ['vue'],
    },
  ],
})
