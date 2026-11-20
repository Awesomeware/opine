import type { TestSuite } from './run-suites.ts'

// A suite owns one fresh database and may include several related test files.
// Keep suites cohesive; adding a file does not require adding another suite.
export const suites: Record<'integration' | 'e2e', TestSuite[]> = {
  integration: [
    {
      name: 'database',
      files: ['server/db/db.integration.ts', 'server/db/example-data.integration.ts'],
    },
    { name: 'authentication', files: ['layers/auth/server/auth.integration.ts'] },
    {
      name: 'feedback',
      files: [
        'layers/feedback/server/posts.integration.ts',
        'layers/feedback/server/participation.integration.ts',
        'layers/feedback/server/contribution-types.integration.ts',
        'layers/feedback/server/outcomes.integration.ts',
        'layers/feedback/server/tags.integration.ts',
      ],
    },
  ],
  e2e: [
    {
      name: 'application-smoke',
      files: [
        'tests/e2e/smoke.e2e.ts',
        'layers/auth/tests/auth.e2e.ts',
        'layers/feedback/tests/feedback.e2e.ts',
        'layers/feedback/tests/participation.e2e.ts',
        'layers/feedback/tests/contribution-types.e2e.ts',
        'layers/feedback/tests/outcomes.e2e.ts',
        'layers/feedback/tests/outcomes-queue.e2e.ts',
        'layers/feedback/tests/tags.e2e.ts',
        'layers/feedback/tests/persistence-setup.e2e.ts',
      ],
      restartFiles: ['layers/feedback/tests/persistence.e2e.ts'],
    },
  ],
}
