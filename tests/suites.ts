// A suite owns one fresh database and may include several related test files.
// Keep suites cohesive; adding a file does not require adding another suite.
export const suites = {
  integration: [{ name: 'database', files: ['server/db/db.integration.ts'] }],
  e2e: [{ name: 'application-smoke', files: ['tests/e2e/smoke.e2e.ts'] }],
}
