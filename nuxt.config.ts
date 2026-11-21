import { defaultCommunity } from './shared/community'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-19',
  ssr: false,
  runtimeConfig: {
    public: {
      community: defaultCommunity,
    },
  },
  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
})
