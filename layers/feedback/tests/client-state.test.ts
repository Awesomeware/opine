import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope } from 'vue'
import { feedbackFailure } from '../app/api/errors.ts'
import { useRequestScope } from '../app/composables/useRequestScope.ts'

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
