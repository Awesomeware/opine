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
- `pnpm typecheck` — check TypeScript and Vue templates.
- `pnpm test` — run lightweight Node tests without Docker or loading `.env`.
- `pnpm test:integration` — run database suites against fresh Testcontainers PostgreSQL instances.
- `pnpm test:e2e` — build and run Playwright browser suites against fresh databases and application servers.
- `pnpm feedback:category upsert|enable|disable ...` — operator category configuration; see [feedback setup](docs/feedback.md).
- `pnpm auth:role grant|revoke <user-id> <role>` — operator role management; see [authentication setup](docs/authentication.md).
- `pnpm layer:new <name>` — scaffold a feature layer using the installed Nuxt CLI.
- `pnpm build` / `pnpm preview` — build for production / preview the build.
- `pnpm db:generate` / `pnpm db:check` — generate migrations / check migration history.
- `pnpm db:migrate` — apply migrations to the database configured by `DATABASE_URL`.

## Architecture

Follow [docs/architecture.md](docs/architecture.md). Opine uses feature modules with vertical slices, assembled into one Nuxt application.

- Put product features in `layers/<feature>/`, with their own `nuxt.config.ts`, UI, server endpoints, use cases, schema, and tests. Start with `pnpm layer:new <feature>` and add folders as needed. Create layers as features are implemented.
- Organize behavior around use cases within each feature. Keep validation, authorization, queries, and transactions close to the operation; introduce service or repository layers only for a concrete benefit.
- Keep HTTP entrypoints focused on request/response handling and delegate substantial behavior to the feature's use-case code. Small endpoints can remain self-contained.
- Keep the application shell, shared database pool, lifecycle hooks, and operational endpoints at the root. Extract shared code only when there is actual reuse.
- Use explicit imports for use cases and cross-feature dependencies. Consume another feature's intentional public functions or contracts, rather than its private implementation. Keep dependencies acyclic and avoid global auto-imports for business logic.
- Keep database access, credentials, and authorization in `server/`. Feature `shared/` code must be safe for both browser and server and independent of Vue and Nitro runtime code.
- Define tables with their owning feature. `server/db/schema.ts` only aggregates feature schema exports; `drizzle/` holds one application-wide migration history. Schema definitions must not import the database client or the aggregate schema.
- Colocate Node-compatible tests with the code they verify, outside framework route and plugin discovery folders. Use `*.test.ts` for lightweight tests, `*.integration.ts` for database integration tests, and `*.e2e.ts` for Playwright journeys. Layers share application namespaces, so use distinct feature routes and component names rather than relying on overrides.

## Testing

Follow [docs/testing.md](docs/testing.md). Each logical integration or E2E suite in `tests/suites.ts` owns one fresh PostgreSQL container; a suite may span several files. Keep suites few and cohesive. Independent suites run in parallel, bounded by `OPINE_TEST_SUITE_CONCURRENCY` (default 2); tests within a suite run serially and must clean up their own data. Never use the development database for automated database suites.

## Authentication boundaries

Follow [layers/auth/README.md](layers/auth/README.md) for the feature's public entrypoints. Resolve the caller with `getAccess(headers)` and enforce permissions on the server for every protected operation. Use internal user IDs for ownership. Every authenticated user is a member; administrator and community-manager roles are independent. Never trust client-supplied actor IDs or role claims, enable automatic account linking, or import test session fixtures into production code.

## Feedback boundaries

Follow [layers/feedback/README.md](layers/feedback/README.md). Create the post and initial author follow in one transaction. Preserve contributions when credentials or users are removed; author/category foreign keys currently restrict deletion. Public responses select only public fields. Keep feedback timestamps at millisecond precision so pagination cursors preserve stored ordering. Require UUID idempotency keys on feedback writes and commit receipts with mutations; authorize before replay. Keep only current post/comment text, `edited_at`, and a version for conflicts—no revision history. Reactions are one Agree or Disagree per account/post and never affect ranking or visibility. Follow controls remain in #5.

## Product direction

Follow the revised scope in [requirements.md](requirements.md). New ordinary contributions require Context or example, Different view, Suggestion, or Question, with corresponding prompts, labels, and discussion filters. Keep the author's proposal, official team response, and status distinct; Agree / Disagree is secondary. Filters organize one flat discussion. Summaries, curated highlights, nested replies, and separate conversation threads remain deferred. Legacy untyped comments remain NULL and display Unspecified; never guess their type. Apply type filters before pagination and resolve direct comment links independently of the selected filter. Omitted type on edit preserves classification. Body-only legacy creates may only replay existing receipts, never create new untyped comments. The prominent official-response/status panel and Team responses filter remain #5. Distinguish planned behavior from the current implementation in feature documentation.

## Programming guidelines

- Code clarity comes first. Use descriptive names, straightforward control flow, and small, cohesive functions. Keep code concise without making it cryptic.
- Prefer TypeScript inference and types derived from Drizzle schemas. Add explicit types or interfaces when they clarify a meaningful contract; avoid duplicating the same shape across layers. Preserve type safety without unnecessary assertions or `any`.
- Introduce abstractions only when they make existing code easier to understand or modify. Avoid speculative extensibility, generic frameworks, and unnecessary wrappers or layers.
- Keep related code together. Extract shared helpers and components when there is a concrete benefit, not merely to create more files.
- Use existing dependencies and framework conventions. Add dependencies only for a demonstrated need.
- Keep database access, credentials, and authorization on the server. Validate external input at its boundary.
- Write comments to explain intent or non-obvious constraints. Keep changes focused on the current task.
- Test meaningful behavior and failure cases. For code changes, run lint, formatting checks, typecheck, build, and relevant tests; for documentation changes, check formatting and links.

## Git commits

- Commit small, cohesive units of work once they are working and the relevant checks pass. Commit during implementation rather than accumulating unrelated changes into one large commit.
- Use `<type>: <reason>` messages, with types such as `feat`, `bug`, `refactor`, `test`, `docs`, and `chore`.
- Keep messages extremely concise and explain why the change is needed, rather than listing what changed. Omit the body when the subject is sufficient.
- Keep every message line at most 80 characters; wrap any body text at 80 characters.
