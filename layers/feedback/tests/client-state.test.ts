import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { effectScope } from 'vue'
import { feedbackFailure } from '../app/api/errors.ts'
import { useFeedbackWrite } from '../app/composables/useFeedbackWrite.ts'
import { useRequestScope } from '../app/composables/useRequestScope.ts'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

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

test('write keys protect unchanged retries only within the current instance', () => {
  const payload = { body: 'A comment', type: 'context' }
  const write = useFeedbackWrite()
  const first = write.headers(payload)

  assert.deepEqual(write.headers({ ...payload }), first)
  assert.notDeepEqual(write.headers({ ...payload, body: 'Changed text' }), first)
  assert.notDeepEqual(useFeedbackWrite().headers(payload), first)

  const beforeCompletion = write.headers(payload)
  write.complete()
  assert.notDeepEqual(write.headers(payload), beforeCompletion)
})

test('write state never reads or writes browser storage', () => {
  let accesses = 0
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      accesses++
      throw new Error('Storage must not be used')
    },
  })

  const write = useFeedbackWrite()
  const headers = write.headers({ body: 'Only in memory' })
  assert.deepEqual(write.headers({ body: 'Only in memory' }), headers)
  write.complete()
  assert.equal(accesses, 0)
})
