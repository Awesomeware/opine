# Working on Opine

Nuxt + TypeScript SPA, Nitro server, PostgreSQL, Drizzle, and Better Auth. Follow [requirements.md](requirements.md) and the agreed steps in [docs/TODO.md](docs/TODO.md).

## Commands

Use the Node version in `.nvmrc` and pnpm version in `package.json`.

```sh
nvm install
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

The app runs at <http://localhost:3000>. See [README.md](README.md) for setup details.

- `pnpm lint` / `pnpm lint:fix` — check code with oxlint / apply fixes.
- `pnpm format` / `pnpm format:check` — format with oxfmt / check formatting.
- `pnpm typecheck` — check application/server TypeScript, Vue templates, tests, and operational scripts.
- `pnpm test` — run lightweight Node tests without Docker or loading `.env`.
- `pnpm test:integration` — run database suites against fresh Testcontainers PostgreSQL instances.
- `pnpm test:e2e` — build and run Playwright browser suites against fresh databases and application servers.
- `pnpm storybook` / `pnpm storybook:build` — develop UI in isolation / build its static catalog.
- `pnpm storybook:typecheck` — check components and stories independently of Nuxt's generated types.
- `pnpm test:ui` — build Storybook and run component browser checks without a database.
- `pnpm feedback:category upsert|enable|disable ...` — operator category configuration; see [feedback setup](docs/feedback.md).
- `pnpm auth:role grant|revoke <user-id> <role>` — operator role management; see [authentication setup](docs/authentication.md).
- `pnpm layer:new <name>` — scaffold a feature layer using the installed Nuxt CLI.
- `pnpm build` / `pnpm preview` — build for production / preview the build.
- `pnpm db:generate` / `pnpm db:check` — generate migrations / check migration history.
- `pnpm db:seed` — apply migrations and add repeatable example feedback without replacing existing content.
- `pnpm db:reset --confirm <database-name>` — erase all application data and restore the default category; see [reset details](README.md#example-data-and-starting-over). Test resets only against disposable databases.
- `pnpm db:migrate` — apply migrations to the database configured by `DATABASE_URL`.
- `pnpm backup` / `pnpm restore` — back up installation files and PostgreSQL / restore into an empty database; see [deployment and recovery](docs/deployment.md). These commands use native PostgreSQL connection settings, not `DATABASE_URL`.

## Architecture

Follow [docs/architecture.md](docs/architecture.md). Opine uses feature modules with vertical slices, assembled into one Nuxt application.

- Put product features in `layers/<feature>/`, with their own `nuxt.config.ts`, UI, server endpoints, use cases, schema, and tests. Start with `pnpm layer:new <feature>` and add folders as needed. Create layers as features are implemented.
- Within feedback, group code by `posts`, `discussion`, `review`, and `subscriptions` in `app/`, `server/`, and `shared/`. Keep route composition and common plumbing explicit; a capability does not automatically need a separate Nuxt layer.
- Organize behavior around use cases within each feature. Keep validation, authorization, queries, and transactions close to the operation; introduce service or repository layers only for a concrete benefit.
- A use case owns the transaction for cross-capability writes. Pass that transaction to owning persistence functions; participating helpers must not open independent transactions. Keep ownership checks, data-consistency locks and dependent writes in the same transaction. Role authorization belongs at the request boundary, after parsing and validation. Joined read projections belong to the capability presenting them.
- Keep HTTP entrypoints focused on request/response handling and delegate substantial behavior to the feature's use-case code. Small endpoints can remain self-contained.
- Keep the application shell, shared database pool, lifecycle hooks, and operational endpoints at the root. Extract shared code only when there is actual reuse.
- Put reusable presentation in `layers/ui/`: shared tokens and document defaults, with component-owned `<style scoped>` CSS. Keep domain components and their stories in their feature layer. See [UI development](docs/ui.md).
- UI primitives accept props, slots, and events; keep API calls, authentication, and feature dependencies out of the UI layer. Import Vue APIs and child components explicitly in components used by Storybook. Application and Storybook must load the same UI foundations.
- Colocate deterministic `*.stories.ts` examples with components. Cover meaningful states and interactions without requiring a database; retain full application journeys for integration behavior. Keep story files out of Nuxt component discovery.
- Use explicit imports for use cases and cross-feature dependencies. Consume another feature's intentional public functions or contracts, rather than its private implementation. Keep dependencies acyclic and avoid global auto-imports for business logic.
- Keep database access, credentials, and authorization in `server/`. Feature `shared/` code must be safe for both browser and server and independent of Vue and Nitro runtime code.
- Define tables with their owning feature. `server/db/schema.ts` only aggregates feature schema exports; `drizzle/` holds one application-wide migration history. Schema definitions must not import the database client or the aggregate schema.
- Colocate Node-compatible tests with the code they verify, outside framework route and plugin discovery folders. Use `*.test.ts` for lightweight tests, `*.integration.ts` for database integration tests, and `*.e2e.ts` for Playwright journeys. Layers share application namespaces, so use distinct feature routes and component names rather than relying on overrides.

## Testing

Follow [docs/testing.md](docs/testing.md). Each logical integration or E2E suite in `tests/suites.ts` owns one fresh PostgreSQL container; a suite may span several files. Keep suites few and cohesive. Independent suites run in parallel, bounded by `OPINE_TEST_SUITE_CONCURRENCY` (default 2); tests within a suite run serially and must clean up their own data. Never use the development database for automated database suites.

## Authentication boundaries

Follow [layers/auth/README.md](layers/auth/README.md) for the feature's public entrypoints. Resolve the caller with `getAccess(headers)` and enforce permissions on the server for every protected operation. Read and validate the request before resolving its session and required role. Authorization is request-scoped: an authorized request may finish after role revocation; subsequent requests, including retries, authorize again. Do not add transactional role rechecks or locks solely to coordinate revocation. Keep resource ownership checks with the relevant use case. Use internal user IDs for ownership. Every authenticated user is a member; administrator and community-manager roles are independent. Never trust client-supplied actor IDs or role claims, enable automatic account linking, or import test session fixtures into production code.

## Feedback boundaries

Use [layers/feedback/README.md](layers/feedback/README.md) for ownership and public endpoints. Follow the canonical domain rules in [docs/feedback.md](docs/feedback.md), especially [retention](docs/feedback.md#contribution-retention), [editing and failed requests](docs/feedback.md#editing-and-failed-requests), and [concurrency](docs/feedback.md#persistence-and-concurrency). Update those rules alongside behavior changes rather than copying them here.

Frontend form state is ephemeral; follow [UI workflow conventions](docs/ui.md#vue-component-readability). Keep authorization, transactions, conflict checks and creation limits on the server. Use existing domain rows for limits; do not add write receipts or browser request-key state. Mutations must not retry automatically.

Append business events in the mutation's existing transaction, using typed metadata without content snapshots. NULL actors explicitly mean system actions; preserve human references. Follow the canonical [event-log rules](docs/events.md), including unchanged-operation behavior.

## Product direction

Follow [requirements.md](requirements.md) for product scope and [docs/TODO.md](docs/TODO.md) for implementation status. Keep proposals, typed discussion, official responses, and status distinct. Preserve historical unclassified comments without guessing their type. New comment requests always require a type.

Follow [Visual direction](docs/design/README.md): the O encloses the tree, followed by lowercase pine. Prioritize desktop with simple narrow-screen reflow. Mockups do not expand the agreed feature scope.

## Programming guidelines

- Code clarity comes first. Use descriptive names, straightforward control flow, and small, cohesive functions. Keep code concise without making it cryptic.
- Separate imports, component contracts, cohesive state groups, functions, and effects with blank lines. Within long handlers, separate validation, requests, and results. Use braces for nested conditionals and loops; avoid compressed template branches and multi-statement event expressions.
- Keep complex client workflows in feature-local composables. Components own rendering, focus, and emitted events; typed API modules own HTTP details. Simple page reads may stay local. Use plain functions for stateless transformations and retain scoped component CSS.
- Use confirmed mutation results to advance local versions and saved values; do not require a second fetch before the form can be used again. Give independent reads, writes, and refreshes separate loading/error state. Guard asynchronous results against disposal and stale reads with the feature's request-scope helper. A successful mutation and failed refresh are distinct outcomes.
- Use domain contracts for API responses rather than types derived from form state. Check errors at the transport boundary. Prefer explicit post/comment contracts over mode switches inferred from optional props.
- Document reusable composable contracts and subtle invariants: account/resource lifetime, confirmed results, and conflict review. Explain intent rather than narrating obvious statements. Preserve behavior with focused regression tests before extracting workflows.
- Prefer TypeScript inference and types derived from Drizzle schemas. Add explicit types or interfaces when they clarify a meaningful contract; avoid duplicating the same shape across layers. Preserve type safety without unnecessary assertions or `any`.
- For cleanup, write a bounded plan and add regression coverage for missing behavior before editing. Prefer deletion and existing helpers; share small validation/query primitives without coupling one command to another through fabricated input. Introduce abstractions only when they make existing code easier to understand or modify. Avoid speculative extensibility, generic frameworks, and unnecessary wrappers or layers.
- Keep write use cases linear: one explicit transaction callback with ordinary operations in execution order. Reuse focused repository functions for recurring queries, creation serialization and limits; pass the transaction explicitly. Avoid wrappers that accept separate authorization and mutation callbacks or hide ordering behind empty hooks.
- In `server/` code, avoid passing functions to other functions except for callbacks such as database transactions, event handlers, or collection operations. Prefer direct calls to named operations over injecting behavior through function arguments.
- Keep related code together. Extract shared helpers and components when there is a concrete benefit, not merely to create more files.
- Use existing dependencies and framework conventions. Add dependencies only for a demonstrated need.
- Keep database access, credentials, and authorization on the server. Validate external input at its boundary.
- Write comments to explain intent or non-obvious constraints. Keep changes focused on the current task.
- Test meaningful behavior and failure cases. Negative validation cases start from valid input and invalidate one field, asserting the intended error. Keep ordinary journeys independent; dedicated restart scenarios own persistence handoffs. For code changes, run lint, formatting checks, typecheck, build, and relevant tests; for documentation changes, check formatting and links.

## Documentation

Keep one canonical home for each rule: product scope in `requirements.md`, architecture in `docs/architecture.md`, domain behavior in feature documentation, UI conventions in `docs/ui.md`, and test lifecycle in `docs/testing.md`. Feature READMEs describe ownership and public entrypoints and link to those rules. Remove completed cleanup plans once their lasting guidance is incorporated; Git retains the history.

## Git commits

- Commit small, cohesive units of work once they are working and the relevant checks pass. Commit during implementation rather than accumulating unrelated changes into one large commit.
- Use `<type>: <reason>` messages, with types such as `feat`, `bug`, `refactor`, `test`, `docs`, and `chore`.
- Keep messages extremely concise and explain why the change is needed, rather than listing what changed. Omit the body when the subject is sufficient.
- Keep every message line at most 80 characters; wrap any body text at 80 characters.
