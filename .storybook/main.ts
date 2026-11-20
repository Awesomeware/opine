import type { StorybookConfig } from '@storybook/vue3-vite'
import vue from '@vitejs/plugin-vue'

const config: StorybookConfig = {
  framework: { name: '@storybook/vue3-vite', options: { docgen: 'vue-component-meta' } },
  stories: ['../layers/*/app/**/*.stories.ts'],
  core: { disableTelemetry: true },
  viteFinal: (config) => ({ ...config, plugins: [...(config.plugins ?? []), vue()] }),
}

export default config
