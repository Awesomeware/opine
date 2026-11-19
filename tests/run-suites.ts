export type TestSuite = { name: string; files: string[] }

export async function runSuites(
  suites: TestSuite[],
  concurrency: number,
  runSuite: (suite: TestSuite) => Promise<void>,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Test suite concurrency must be a positive integer.')
  }

  let next = 0
  const errors: Error[] = []
  async function worker() {
    while (next < suites.length) {
      const suite = suites[next++]!
      try {
        await runSuite(suite)
      } catch (cause) {
        errors.push(new Error(`Test suite "${suite.name}" failed.`, { cause }))
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, suites.length) }, worker))
  if (errors.length) {
    throw new AggregateError(errors, errors.map((error) => error.message).join('\n'))
  }
}
