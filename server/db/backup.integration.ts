import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'pg'
import { parse } from 'dotenv'
import { createAuth } from '../../layers/auth/server/auth.ts'
import { getUserRoles } from '../../layers/auth/server/roles.ts'
import { createMember } from '../../layers/auth/tests/fixtures.ts'
import { examplePostIds, seedExampleData } from '../../layers/feedback/server/example-data.ts'
import { getPost } from '../../layers/feedback/server/posts/queries.ts'
import { archivePost, setPostLocked } from '../../layers/feedback/server/review/moderation.ts'
import { closeDatabase } from './index.ts'
import { readCommunity } from '../community/config.ts'
import { resetDatabase } from './maintenance.ts'

const databaseUrl = process.env.OPINE_TEST_DATABASE_URL
assert.ok(databaseUrl, 'Run integration tests with pnpm test:integration.')
assert.equal(process.env.DATABASE_URL, databaseUrl)
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1))

async function contents(client: Client) {
  const { rows: tables } = await client.query<{ schema: string; name: string }>(
    "select schemaname as schema, tablename as name from pg_tables where schemaname in ('public', 'drizzle') order by schemaname, tablename",
  )
  const result = []
  for (const table of tables) {
    // Names come from PostgreSQL's catalog; quote identifiers, including embedded quotes.
    const identifier = [table.schema, table.name]
      .map((name) => `"${name.replaceAll('"', '""')}"`)
      .join('.')
    const { rows } = await client.query(
      `select to_jsonb(row) as value from ${identifier} row order by to_jsonb(row)::text`,
    )
    result.push({ ...table, rows })
  }
  return result
}

test('operator backup restores configuration, all records and working identities into an isolated database', async (context) => {
  assert.ok(process.env.OPINE_TEST_POSTGRES_CONTAINER_ID)
  assert.ok(process.env.OPINE_TEST_POSTGRES_USER)
  const directory = await mkdtemp(join(tmpdir(), 'opine-backup-'))
  const installation = join(directory, 'installation')
  const backup = join(directory, 'backup')
  const restoredInstallation = join(directory, 'restored-installation')
  const authSecret = process.env.BETTER_AUTH_SECRET!
  assert.ok(authSecret)
  const corrupt = join(directory, 'corrupt')
  const bin = join(directory, 'bin')
  const targetName = `opine_restore_${randomUUID().replaceAll('-', '')}`
  const targetUrl = new URL(databaseUrl)
  targetUrl.pathname = `/${targetName}`
  const source = new Client({ connectionString: databaseUrl })
  const target = new Client({ connectionString: targetUrl.toString() })
  let created = false

  async function cli(script: string, args: string[], name: string) {
    const child = spawn('bash', [`scripts/${script}.sh`, ...args], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        PGDATABASE: name,
        PGUSER: process.env.OPINE_TEST_POSTGRES_USER,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    const code = await new Promise<number | null>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', resolve)
    })
    assert.ok(!output.includes(databaseUrl!))
    assert.ok(!output.includes(authSecret))
    return { code, output }
  }

  try {
    await mkdir(join(installation, 'config'), { recursive: true })
    await mkdir(bin)
    // Use native PostgreSQL clients in this suite's existing container. Archives stream
    // through stdio, so neither host PostgreSQL tools nor mounted volumes are needed.
    for (const command of ['pg_dump', 'pg_restore', 'psql']) {
      const wrapper = join(bin, command)
      await writeFile(
        wrapper,
        `#!/bin/sh\nexec docker exec -i -e PGDATABASE -e PGUSER "$OPINE_TEST_POSTGRES_CONTAINER_ID" ${command} "$@"\n`,
      )
      await chmod(wrapper, 0o700)
    }
    const configuration = {
      '.env': `BETTER_AUTH_SECRET=${authSecret}\nDATABASE_URL=${databaseUrl}\n`,
      'config/community.json': '{"name":"Restored community","url":"https://example.test"}\n',
      'config/rules.md': '# Our rules\n\nCriticism is welcome.\n',
    }
    for (const [path, value] of Object.entries(configuration)) {
      await writeFile(join(installation, path), value)
    }

    await seedExampleData()
    const member = await createMember({ roles: ['administrator', 'community-manager'] })
    await setPostLocked(member.user.id, examplePostIds[0], true)
    await archivePost(member.user.id, examplePostIds[1])
    await source.connect()
    context.diagnostic(
      `Backup/restore drill: PostgreSQL ${(await source.query('show server_version')).rows[0].server_version}`,
    )
    const original = await contents(source)
    assert.ok(original.find((table) => table.name === '__drizzle_migrations')!.rows.length)
    assert.ok(original.find((table) => table.name === 'event_log')!.rows.length)

    const saved = await cli('backup', [installation, backup], databaseName)
    assert.equal(saved.code, 0, saved.output)
    assert.equal((await stat(backup)).mode & 0o777, 0o700)
    for (const [path, value] of Object.entries(configuration)) {
      assert.equal(await readFile(join(backup, path), 'utf8'), value)
      assert.equal((await stat(join(backup, path))).mode & 0o077, 0)
    }
    assert.equal((await stat(join(backup, 'database.dump'))).mode & 0o077, 0)
    await mkdir(restoredInstallation)
    await cp(join(backup, 'config'), join(restoredInstallation, 'config'), { recursive: true })
    await cp(join(backup, '.env'), join(restoredInstallation, '.env'))
    const restoredEnvironment = parse(await readFile(join(restoredInstallation, '.env')))
    assert.deepEqual(readCommunity(join(restoredInstallation, 'config')), {
      name: 'Restored community',
      footerDisclaimer: '',
      url: 'https://example.test/',
      rulesHtml: '<h1>Our rules</h1>\n<p>Criticism is welcome.</p>\n',
    })
    const repeated = await cli('backup', [installation, backup], databaseName)
    assert.notEqual(repeated.code, 0, repeated.output)

    await source.query(`create database "${targetName}"`)
    created = true
    await target.connect()
    const refused = await cli('restore', [backup, '--confirm', 'wrong'], targetName)
    assert.notEqual(refused.code, 0, refused.output)
    assert.deepEqual(await contents(target), [])

    await cp(backup, corrupt, { recursive: true })
    const dump = await readFile(join(backup, 'database.dump'))
    await writeFile(join(corrupt, 'database.dump'), dump.subarray(0, Math.floor(dump.length / 2)))
    const invalid = await cli('restore', [corrupt, '--confirm', targetName], targetName)
    assert.notEqual(invalid.code, 0, invalid.output)
    assert.deepEqual(await contents(target), [], 'Failed restore must leave no partial tables.')

    const restored = await cli('restore', [backup, '--confirm', targetName], targetName)
    assert.equal(restored.code, 0, restored.output)
    assert.deepEqual(await contents(target), original)
    const occupied = await cli('restore', [backup, '--confirm', targetName], targetName)
    assert.notEqual(occupied.code, 0, occupied.output)
    assert.deepEqual(await contents(target), original)

    // Exercise restored records through application reads and signed-session validation.
    await closeDatabase()
    process.env.DATABASE_URL = targetUrl.toString()
    process.env.BETTER_AUTH_SECRET = restoredEnvironment.BETTER_AUTH_SECRET
    const restoredSession = await createAuth().api.getSession({
      headers: new Headers({ cookie: member.cookieHeader }),
    })
    assert.equal(restoredSession?.user.id, member.user.id)
    assert.deepEqual((await getUserRoles(member.user.id)).toSorted(), [
      'administrator',
      'community-manager',
      'member',
    ])
    assert.ok((await getPost(examplePostIds[0]))?.lockedAt)
    assert.equal(await getPost(examplePostIds[1]), undefined)
  } finally {
    await closeDatabase()
    process.env.DATABASE_URL = databaseUrl
    process.env.BETTER_AUTH_SECRET = authSecret
    await target.end()
    if (created) await source.query(`drop database "${targetName}"`)
    await source.end()
    await resetDatabase(databaseName)
    await closeDatabase()
    await rm(directory, { recursive: true, force: true })
  }
})
