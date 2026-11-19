import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runSuites } from './run-suites.ts'

const suites = ['first', 'second', 'third'].map((name) => ({ name, files: [`${name}.ts`] }))

test('runs suites in parallel up to the limit, exactly once each', async () => {
  const release = Promise.withResolvers<void>()
  const thirdStarted = Promise.withResolvers<void>()
  const started: string[] = []
  let active = 0
  let peak = 0
  const running = runSuites(suites, 2, async (suite) => {
    started.push(suite.name)
    active++
    peak = Math.max(peak, active)
    if (suite.name === 'third') thirdStarted.resolve()
    await release.promise
    active--
  })

  assert.deepEqual(started, ['first', 'second'])
  assert.equal(active, 2)
  release.resolve()
  await thirdStarted.promise
  await running
  assert.deepEqual(started, ['first', 'second', 'third'])
  assert.equal(peak, 2)
  assert.equal(active, 0)
})

test('collects failures while finishing remaining suites and waiting for active cleanup', async () => {
  const cleanup = Promise.withResolvers<void>()
  const thirdStarted = Promise.withResolvers<void>()
  const started: string[] = []
  const failure = new Error('database failed')
  let settled = false
  let cleaned = false
  const running = runSuites(suites, 2, async (suite) => {
    started.push(suite.name)
    if (suite.name === 'first') throw failure
    if (suite.name === 'third') {
      thirdStarted.resolve()
      throw new Error('browser failed')
    }
    await cleanup.promise
    cleaned = true
  })
  const result = running.catch((error: unknown) => {
    settled = true
    return error
  })

  await thirdStarted.promise
  assert.deepEqual(started, ['first', 'second', 'third'])
  assert.equal(settled, false)
  assert.equal(cleaned, false)
  cleanup.resolve()
  const error = await result
  assert.equal(cleaned, true)
  assert.ok(error instanceof AggregateError)
  assert.equal(error.errors.length, 2)
  assert.match(error.message, /first/)
  assert.match(error.message, /third/)
  assert.equal(error.errors[0].cause, failure)
})

test('rejects invalid concurrency before starting any suite', async () => {
  let calls = 0
  for (const concurrency of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await assert.rejects(
      runSuites(suites, concurrency, async () => {
        calls++
      }),
      /positive integer/,
    )
  }
  assert.equal(calls, 0)
})
