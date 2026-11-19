import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
const baseURL = process.env.OPINE_TEST_BASE_URL
const suiteName = process.env.OPINE_TEST_SUITE_NAME
if (!databaseUrl || process.env.DATABASE_URL !== databaseUrl || !baseURL || !suiteName) {
  throw new Error('Run browser tests with pnpm test:e2e to start an isolated database and server.')
}
const server = new URL(baseURL)

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/**/*.e2e.ts', 'layers/**/*.e2e.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: `test-results/${suiteName}/${process.env.OPINE_TEST_PHASE ?? 'main'}`,
  use: {
    baseURL,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    env: {
      DATABASE_URL: databaseUrl,
      HOST: server.hostname,
      PORT: server.port,
      NITRO_HOST: server.hostname,
      NITRO_PORT: server.port,
      NITRO_UNIX_SOCKET: '',
      NITRO_SSL_CERT: '',
      NITRO_SSL_KEY: '',
    },
    url: new URL('/api/ready', baseURL).href,
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
  },
})
