// A suite owns one fresh database and may include several related test files.
// Keep suites cohesive; adding a file does not require adding another suite.
export const suites = {
  integration: [
    { name: 'database', files: ['server/db/db.integration.ts'] },
    { name: 'authentication', files: ['layers/auth/server/auth.integration.ts'] },
    { name: 'feedback', files: ['layers/feedback/server/posts.integration.ts'] },
  ],
  e2e: [
    {
      name: 'application-smoke',
      files: ['tests/e2e/smoke.e2e.ts', 'layers/auth/tests/auth.e2e.ts'],
    },
  ],
}
