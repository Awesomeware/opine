import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { effectScope } from 'vue'
import { feedbackFailure } from '../app/api/errors.ts'
import { useFeedbackWrite } from '../app/composables/useFeedbackWrite.ts'
import { useRequestScope } from '../app/composables/useRequestScope.ts'
import { readStoredValue, writeStoredValue, removeStoredValue } from '../app/utils/stored-input.ts'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

function memoryStorage() {
  const values = new Map<string, string>()

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })

  return values
}

test('transport error narrowing rejects malformed field errors without assuming an error shape', () => {
  for (const error of [null, undefined, 'network error', [], new Error('offline')]) {
    assert.deepEqual(feedbackFailure(error), { status: undefined, fieldErrors: {} })
  }

  assert.deepEqual(
    feedbackFailure({
      statusCode: 400,
      data: {
        data: {
          fieldErrors: {
            title: 'Required',
            tagIds: 42,
            description: null,
          },
        },
      },
    }),
    { status: 400, fieldErrors: { title: 'Required' } },
  )
})

test('request scopes reject older reads and all results after their owning scope is disposed', () => {
  const scope = effectScope()
  const requests = scope.run(useRequestScope)!
  const first = requests.startRequest()
  const second = requests.startRequest()

  assert.equal(first(), false)
  assert.equal(second(), true)
  assert.equal(requests.isActive(), true)

  scope.stop()
  assert.equal(second(), false)
  assert.equal(requests.isActive(), false)
})

test('pending writes retain exact legacy payloads and keys across mounts, isolate accounts, and change keys for new intent', () => {
  const stored = memoryStorage()
  const scope = 'edit.member-a.post-a'
  const key = `opine.feedback.pending.${scope}`
  const payload = { title: 'Original', description: 'Body', desiredImprovement: null, version: 1 }
  const original = useFeedbackWrite(scope)
  const headers = original.headers(payload)
  const restored = useFeedbackWrite(scope)

  assert.deepEqual(restored.pendingBody.value, payload)
  assert.deepEqual(restored.headers(payload), headers)
  assert.equal(JSON.parse(stored.get(key)!).payload, JSON.stringify(payload))
  assert.equal(useFeedbackWrite('edit.member-b.post-a').pendingBody.value, null)
  assert.notDeepEqual(restored.headers({ ...payload, tagIds: [] }), headers)

  restored.complete()
  assert.equal(stored.has(key), false)
  assert.equal(restored.pendingBody.value, null)
})

test('storage corruption and unavailable storage do not fabricate a pending payload or prevent safe in-memory retries', () => {
  const stored = memoryStorage()
  stored.set(
    'opine.feedback.pending.bad',
    JSON.stringify({ key: crypto.randomUUID(), payload: '{broken' }),
  )
  const bad = useFeedbackWrite('bad')
  assert.equal(bad.pendingBody.value, null)
  assert.ok(bad.warning.value)
  stored.set('draft', '{broken')
  assert.deepEqual(readStoredValue('draft'), { success: false })

  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable')
    },
  })
  const write = useFeedbackWrite('offline')
  const first = write.headers({ body: 'Keep this draft' })
  assert.deepEqual(write.headers({ body: 'Keep this draft' }), first)
  assert.equal(writeStoredValue('draft', {}), false)
  assert.equal(removeStoredValue('draft'), false)
  assert.doesNotThrow(() => write.complete())
})

test('invalid pending receipt keys are rejected without blocking a new explicit submission', () => {
  const stored = memoryStorage()

  for (const key of ['', 'not-a-uuid', 12]) {
    stored.set(
      'opine.feedback.pending.invalid',
      JSON.stringify({ key, payload: '{"kind":"agree"}' }),
    )
    const write = useFeedbackWrite('invalid')

    assert.equal(write.pendingBody.value, null)
    assert.ok(write.warning.value)
    assert.match(write.headers({ kind: 'agree' })['Idempotency-Key'], /^[0-9a-f-]{36}$/)
  }
})
