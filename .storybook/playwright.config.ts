import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:6007'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.ui.ts',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  outputDir: '../test-results/ui',
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: `${baseURL}/index.json`,
    reuseExistingServer: false,
  },
})
