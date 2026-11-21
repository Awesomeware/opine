# Testing

Use the Node and pnpm versions pinned in `.nvmrc` and `package.json`.

| Command                    | Scope                                                  | Requirements                        |
| -------------------------- | ------------------------------------------------------ | ----------------------------------- |
| `pnpm typecheck`           | Application, server, Vue templates, tests, and scripts | Installed dependencies              |
| `pnpm test`                | Lightweight `*.test.ts` tests discovered by Node       | Installed dependencies              |
| `pnpm test:integration`    | Database integration suites                            | Running Docker-compatible runtime   |
| `pnpm test:e2e`            | Production build and Playwright browser suites         | Docker runtime and Chromium         |
| `pnpm test:ui`             | Storybook build and component browser checks           | Installed dependencies and Chromium |
| `pnpm storybook:typecheck` | Standalone component/story TypeScript checks           | Installed dependencies              |

`pnpm typecheck` first generates/checks Nuxt types, then checks `tsconfig.tests.json` for operational scripts, root and feature test code, and the application Playwright configuration. Browser callbacks use DOM types. Storybook retains its separate component/story typecheck.

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

An E2E suite can declare `restartFiles` for a second phase. After its ordinary tests finish and Playwright stops the app, the runner restarts the same PostgreSQL container, refreshes its potentially changed mapped port, and launches a fresh app process at the same public origin. A dedicated persistence scenario creates the posts, sessions, follows, comments, reactions, official responses, and notifications for this phase, then records a small private handoff manifest in a temporary directory removed in the runner's `finally` block. Ordinary journeys clean up their own data; restart assertions do not depend on their interaction counts or incidental versions. The verification phase deletes the retained scenario rows. The E2E server uses a one-hour post cooldown so restart assertions are independent of suite speed; integration tests exercise the default 60-second cooldown and expiry. No extra database container is started for this check.

## Current coverage

- Tags are covered within the existing feedback integration and application browser suites: catalog authorization, case-insensitive names, migration of existing posts, disabled assignments, atomic edits, ephemeral forms, catalog outages, lost replies, and persistence after restart. Reset/seed checks cover default tags and preservation of removed example assignments.

- Isolated Storybook checks exercise shared controls and representative feedback presentation without a database or Nuxt server. Checks include keyboard contribution and multi-tag selection, inactive tag retention, stable response links, status semantics, and long content at narrow widths. Stories cover supported states with deterministic data; see [UI development](ui.md). These checks complement the application journeys and do not establish screenshot regression baselines.

- Lightweight tests cover database configuration, pool lifecycle, suite scheduling, the independent role permission matrix, safe auth diagnostics, and feedback/filter/participation/official-workflow validation.
- The `database` integration suite covers real queries, reconnecting after pool shutdown, migration history and reapplication, and test-data persistence across connections. It also exercises the example-data/reset CLI, concurrent and repeated seeding, preservation of existing content, reset confirmation failures, full application-data removal, and reseeding. Destructive checks use only its disposable database; fresh-schema checks use another database in that same container.
- The `authentication` integration suite covers Discord callbacks with controlled provider responses, internal identity persistence, rejected implicit linking, OAuth state, session expiry/revocation/sign-out, role persistence, concurrent role mutations, the operator CLI, and HTTP rate limits. Browser checks verify that role authorization happens after reading the complete request body.
- The `feedback` integration suite covers atomic post/follow rollback, author privacy, restrictive deletion, category configuration, literal search, exact pagination, concurrent post cooldowns and row-based creation limits, author-only edits, conflict detection, reaction changes, contribution-type filtering before pagination, type edits, legacy comments, rejected body-only creates, and preserved omitted fields. Official-workflow tests cover atomic response/status/notification rollback, concurrent managers, workflow conflicts, subscription changes, private inbox pagination/read state, category audits, and review-queue follow-up rules.
- The `application-smoke` browser suite checks the rendered page and database readiness, Discord redirect initiation, session reload/sign-out, server authorization boundaries, CSRF protection, and rejection of forged rate-limit IP headers. Request-time authorization tests let an authorized publication finish after revocation and reject its subsequent retry. Role requirements for tag writes, official writes, review queues and category history are verified at HTTP boundaries. It also covers feedback publication, discarding unsaved forms on reload/navigation, public links, filtering, pagination, mobile overflow checks, comments and direct links, edit-conflict review, uncertain responses without automatic mutation retries, official response/status publication, follow notifications, queue authorization, and the database/app restart phase.

Migration checks share a small test-only helper for temporary database lifecycle and applying migration ranges; each test keeps its SQL setup and assertions visible. They apply the committed authentication and feedback schema to fresh databases. The contribution-type upgrade test also creates a temporary database inside the existing feedback suite container, applies migrations through the untyped-comment schema, seeds an old comment and receipt, then applies the new migration. It verifies the historical migration preserves the original content and receipt and sets the new type to NULL, then drops that temporary database. A separate current-upgrade check verifies receipt removal retains posts, comments, follows and cooldown timestamps. The official-workflow upgrade test similarly verifies existing posts and comments retain their text, versions, and follows while receiving the initial workflow version. No extra container or development database is used. Auth tests use a small feature-owned `createMember` factory that creates genuine database identities and signed sessions; it is guarded against use outside the isolated test database. Browser tests do not require real Discord credentials or introduce a test-only login endpoint. A real Discord consent round trip remains a deployment check; see [Authentication](authentication.md). CI remains deferred.

## Remaining release verification

The checks below are planned release work, not completed coverage. Track them in [steps 6–9](TODO.md#6-add-basic-moderation--next):

- Moderation: CM-only lock/unlock/archive actions, locked content remaining readable while writes are rejected, and archived posts and related content excluded from public/CM queries, direct links, notifications and unread counts. Verify no archive/lock alerts, no archived-post publication/fanout, and persistence without deleting content.
- Community configuration: public name, rules and community link appear in the intended views.
- Accessibility: keyboard navigation, accessible names, focus, contrast, form errors and status identification across the release journeys, plus basic narrow-screen readability.
- Deployment: a real Discord consent/sign-in, session reload and sign-out on the configured HTTPS origin, and operational errors that do not disclose private data.
- Recovery: back up the database and installation configuration, restore into an isolated installation, and verify content, accounts, permissions and post lock/archive state. The existing database/application restart test does not prove backup restoration.

Run the full local checks and [pilot walkthrough](../journeys.md#pilot-walkthrough) on the release candidate and record the results. CI remains deferred; these checks still gate the public pilot.

## Adding tests

Keep feature tests inside their layer, near the behavior they verify and outside Nuxt route or plugin discovery folders. Feedback server tests are grouped under `server/{posts,discussion,review,subscriptions}/`; browser journeys under `tests/{posts,discussion,review}/` follow the initiating capability, including cross-capability journeys. Shared validation tests live beside `shared/<capability>/input.ts`. Moving tests into capability folders does not create new logical suites or containers. Use these suffixes consistently:

- `*.test.ts`: lightweight tests, discovered automatically by `pnpm test`; no Docker or `.env` loading.
- `*.integration.ts`: Node database tests; add the file to an integration suite in `tests/suites.ts`.
- `*.e2e.ts`: Playwright journeys; add the file to an E2E suite in `tests/suites.ts`.
- `*.stories.ts`: colocated Storybook examples. Component browser checks live in `.storybook/tests/*.ui.ts` and run with `pnpm test:ui`; they are independent of database suites and Node test discovery.

Node's default discovery also treats names such as `test-*.ts` as tests. Name executable helpers `run-*.ts`, as in `scripts/run-database-suites.ts`, so `pnpm test` does not execute them accidentally.

Keep test objects deterministic, with small feature-owned factories when domain objects arrive. Use direct assertions for simple outcomes and authorization decisions. Negative validation tests start with valid input and invalidate one field at a time; assert the intended field error so another invalid field cannot mask a regression. Split long journeys by behavior within the existing suite rather than adding containers. Introduce snapshots for substantial, stable outputs when they add useful coverage, and review updates as code changes.

Node's existing test runner supports `t.assert.snapshot(value)`. When snapshot tests are introduced, create or update their baselines explicitly with:

```sh
pnpm test --test-update-snapshots
```

Commit the generated snapshot files with their tests. Ordinary test runs must compare against those baselines without updating them.

For code changes, run lint, formatting checks, typecheck, build, and the relevant test commands. See [Architecture](architecture.md#tests-and-verification) for ownership and runtime boundaries.
