# Testing

Use the Node and pnpm versions pinned in `.nvmrc` and `package.json`.

| Command                 | Scope                                            | Requirements                      |
| ----------------------- | ------------------------------------------------ | --------------------------------- |
| `pnpm test`             | Lightweight `*.test.ts` tests discovered by Node | Installed dependencies            |
| `pnpm test:integration` | Database integration suites                      | Running Docker-compatible runtime |
| `pnpm test:e2e`         | Production build and Playwright browser suites   | Docker runtime and Chromium       |

Install the browser with `pnpm exec playwright install chromium`. On Linux, `pnpm exec playwright install --with-deps chromium` also installs required system packages when needed. Docker Compose is for local development and is not needed for tests. The first database-backed run downloads the PostgreSQL image if it is not cached.

## Suite isolation and resource limits

A **logical suite** is an entry in [tests/suites.ts](../tests/suites.ts), potentially containing multiple related files. The database-backed runner starts one fresh PostgreSQL 18 container per suite, applies committed migrations from `drizzle/`, and passes its generated connection URL to that suite's test process. It overrides any inherited `DATABASE_URL`; the development database is never used. Authentication suites receive generated test secrets and dummy Discord credentials; E2E uses its assigned server origin for authentication. Containers use dynamically assigned ports and are stopped after their suite finishes, including test failures.

Independent suites can run in parallel because they have separate databases. At most two suites run concurrently by default. Set a positive integer to change that limit:

```sh
OPINE_TEST_SUITE_CONCURRENCY=1 pnpm test:integration
OPINE_TEST_SUITE_CONCURRENCY=2 pnpm test:e2e
```

The limit applies per command invocation. Running both commands simultaneously can therefore use up to four PostgreSQL containers. Testcontainers also runs its small Ryuk cleanup helper, so the suite limit is not a limit on all Docker containers.

Tests within a suite run serially: Node uses `--test-concurrency=1` and Playwright uses one worker. Files in the same suite share a database, so tests must clean up their own data and avoid depending on another test's execution order. Keep the suite catalog small and cohesive; add related files to an existing suite before creating a new isolation boundary.

Each E2E suite also starts its own built Nitro application on a dynamically assigned localhost port. Playwright shuts down that server before the runner stops PostgreSQL. Existing development servers are not reused. Run E2E tests through `pnpm test:e2e`; the runner supplies the required `OPINE_TEST_*` configuration. Failure traces and browser screenshots are saved under `test-results/<suite-name>/<phase>/`.

An E2E suite can declare `restartFiles` for a second phase. After its ordinary tests finish and Playwright stops the app, the runner restarts the same PostgreSQL container, refreshes its potentially changed mapped port, and launches a fresh app process at the same public origin. The feedback journeys deliberately retain posts, sessions, follows, comments, reactions, and write receipts for this phase. Their private handoff files are stored in a temporary directory removed in the runner's `finally` block. The verification phase deletes the retained scenario rows. No extra database container is started for this check.

## Current coverage

- Lightweight tests cover database configuration, pool lifecycle, suite scheduling, the independent role permission matrix, safe auth diagnostics, and feedback/filter/participation validation.
- The `database` integration suite covers real queries, reconnecting after pool shutdown, migration history and reapplication, and test-data persistence across connections.
- The `authentication` integration suite covers Discord callbacks with controlled provider responses, internal identity persistence, rejected implicit linking, OAuth state, session expiry/revocation/sign-out, role mutations, the operator CLI, and HTTP rate limits.
- The `feedback` integration suite covers atomic post/follow rollback, author privacy, restrictive deletion, category configuration, literal search, exact pagination, concurrent submission limits, atomic receipts and retry deduplication, author-only edits, conflict detection, reaction changes, contribution-type filtering before pagination, type edits, legacy comments, and pre-upgrade retry receipts.
- The `application-smoke` browser suite checks the rendered page and database readiness, Discord redirect initiation, session reload/sign-out, server authorization boundaries, CSRF protection, and rejection of forged rate-limit IP headers. It also covers feedback publication, draft preservation, public links, filtering, pagination, mobile overflow checks, comments and direct links, edit-conflict review, safe retry after a lost response/reload, and the database/app restart phase.

Migration checks apply the committed authentication and feedback schema to fresh databases. The contribution-type upgrade test also creates a temporary database inside the existing feedback suite container, applies migrations through the untyped-comment schema, seeds an old comment and receipt, then applies the new migration. It verifies the original content and receipt remain unchanged and the new type is NULL, then drops that temporary database. No extra container or development database is used. Auth tests use a small feature-owned `createMember` factory that creates genuine database identities and signed sessions; it is guarded against use outside the isolated test database. Browser tests do not require real Discord credentials or introduce a test-only login endpoint. A real Discord consent round trip remains a deployment check; see [Authentication](authentication.md). CI remains deferred.

## Adding tests

Keep feature tests inside their layer, near the behavior they verify and outside Nuxt route or plugin discovery folders. Use these suffixes consistently:

- `*.test.ts`: lightweight tests, discovered automatically by `pnpm test`; no Docker or `.env` loading.
- `*.integration.ts`: Node database tests; add the file to an integration suite in `tests/suites.ts`.
- `*.e2e.ts`: Playwright journeys; add the file to an E2E suite in `tests/suites.ts`.

Node's default discovery also treats names such as `test-*.ts` as tests. Name executable helpers `run-*.ts`, as in `scripts/run-database-suites.ts`, so `pnpm test` does not execute them accidentally.

Keep test objects deterministic, with small feature-owned factories when domain objects arrive. Use direct assertions for simple outcomes and authorization decisions. Introduce snapshots for substantial, stable outputs when they add useful coverage, and review updates as code changes.

Node's existing test runner supports `t.assert.snapshot(value)`. When snapshot tests are introduced, create or update their baselines explicitly with:

```sh
pnpm test --test-update-snapshots
```

Commit the generated snapshot files with their tests. Ordinary test runs must compare against those baselines without updating them.

For code changes, run lint, formatting checks, typecheck, build, and the relevant test commands. See [Architecture](architecture.md#tests-and-verification) for ownership and runtime boundaries.
