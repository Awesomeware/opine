import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { suites } from '../tests/suites.ts'
import { runSuites, type TestSuite } from '../tests/run-suites.ts'

const kind = process.argv[2]
if ((kind !== 'integration' && kind !== 'e2e') || process.argv.length !== 3) {
  throw new Error('Usage: node scripts/run-database-suites.ts <integration|e2e>')
}

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const children = new Set<ChildProcess>()
let interrupted = false

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    interrupted = true
    process.exitCode = signal === 'SIGINT' ? 130 : 143
    for (const child of children) child.kill(signal)
  })
}

function checkInterrupted() {
  if (interrupted) throw new Error('Test run interrupted.')
}

async function runTests(args: string[], env: NodeJS.ProcessEnv) {
  checkInterrupted()
  let child: ChildProcess | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      child = spawn(process.execPath, args, { env, stdio: 'inherit' })
      children.add(child)
      child.once('error', reject)
      child.once('exit', (code, signal) => {
        if (code === 0) resolve()
        else reject(new Error(`Test process failed (${signal ?? code}).`))
      })
    })
  } finally {
    if (child) children.delete(child)
  }
}

async function availablePort() {
  const server = createServer()
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a test server port.'))
        return
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function runSuite(suite: TestSuite) {
  checkInterrupted()
  console.log(`Starting isolated ${kind} suite: ${suite.name}`)
  const postgres = await new PostgreSqlContainer('postgres:18').withDatabase('opine_test').start()
  let artifacts: string | undefined

  try {
    checkInterrupted()
    const databaseUrl = postgres.getConnectionUri()
    const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
    try {
      await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    } finally {
      await pool.end()
    }

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      OPINE_TEST_DATABASE_URL: databaseUrl,
      OPINE_TEST_SUITE_NAME: suite.name,
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      DISCORD_CLIENT_ID: 'opine-test-client',
      DISCORD_CLIENT_SECRET: 'opine-test-secret',
      AUTH_SIGN_IN_MAX: '10',
      AUTH_SIGN_IN_WINDOW_SECONDS: '60',
      FEEDBACK_POST_MAX: '5',
      FEEDBACK_POST_WINDOW_SECONDS: '60',
      FEEDBACK_COMMENT_MAX: '10',
      FEEDBACK_REACTION_MAX: '30',
      FEEDBACK_EDIT_MAX: '20',
      FEEDBACK_PARTICIPATION_WINDOW_SECONDS: '60',
    }

    if (kind === 'integration') {
      await runTests(['--test', '--test-concurrency=1', ...suite.files], env)
    } else {
      const baseURL = `http://127.0.0.1:${await availablePort()}`
      artifacts = await mkdtemp(join(tmpdir(), 'opine-e2e-'))
      const browserEnv = {
        ...env,
        OPINE_TEST_BASE_URL: baseURL,
        BETTER_AUTH_URL: baseURL,
        OPINE_TEST_ARTIFACT_DIR: artifacts,
        OPINE_TEST_PHASE: 'main',
      }
      await runTests(
        [fileURLToPath(import.meta.resolve('@playwright/test/cli')), 'test', ...suite.files],
        browserEnv,
      )
      if (suite.restartFiles?.length) {
        // Playwright has stopped the first application process. Restart the same
        // database container, then serve the saved link from a fresh app process.
        checkInterrupted()
        await postgres.restart()
        // Docker may assign a new host port when restarting an ephemeral mapping.
        const restartedDatabaseUrl = postgres.getConnectionUri()
        console.log(`Verifying persistence after database and app restart: ${suite.name}`)
        await runTests(
          [
            fileURLToPath(import.meta.resolve('@playwright/test/cli')),
            'test',
            ...suite.restartFiles,
          ],
          {
            ...browserEnv,
            DATABASE_URL: restartedDatabaseUrl,
            OPINE_TEST_DATABASE_URL: restartedDatabaseUrl,
            OPINE_TEST_PHASE: 'restart',
          },
        )
      }
    }
  } finally {
    try {
      await postgres.stop()
    } finally {
      if (artifacts) await rm(artifacts, { recursive: true, force: true })
    }
    console.log(`Stopped database for suite: ${suite.name}`)
  }
}

try {
  const concurrency = Number(process.env.OPINE_TEST_SUITE_CONCURRENCY ?? 2)
  await runSuites(suites[kind], concurrency, runSuite)
} catch (error) {
  console.error(error)
  process.exitCode ||= 1
}
