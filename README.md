# Opine

Opine is an open-source community feedback tool for players and community managers. Its visual identity is an **O enclosing a pine tree, followed by lowercase “pine”**.

## Technology choices

- **Nuxt and Vue with TypeScript** for a client-rendered single-page application.
- **Nitro**, Nuxt's server runtime, for API endpoints and authentication in the same Node.js application.
- **PostgreSQL** for persistent application and authentication data.
- **Drizzle ORM and Drizzle Kit** for typed database access and reviewed, committed SQL migrations.
- **Better Auth** for authentication, using its Drizzle integration and database-backed sessions.
- **Discord** as the only sign-in method in the first version. Internal Opine user IDs own content and permissions; external login identities link to those users. Additional providers can be integrated later through Better Auth's provider or plugin interfaces.
- **pnpm** for dependency management, with `pnpm-lock.yaml` committed to the repository.
- **oxlint and oxfmt** for linting and formatting.

Initialized with the official `create-nuxt` minimal template and **Nuxt 4.6.4**, the latest stable release verified on 19 November 2026. Nuxt is pinned in `package.json`; exact dependency resolutions are recorded in `pnpm-lock.yaml`.

TypeScript is kept on the compatible **6.0.x** release line because the current Vue tooling does not support TypeScript 7.

## Local development

Use **Node.js 26.7.0**, pinned in `.nvmrc`, and **pnpm 12.21.0**, pinned in `package.json`.

```sh
nvm install
nvm use
pnpm install --frozen-lockfile
cp .env.example .env
docker compose up -d --wait
pnpm db:migrate
pnpm dev
```

If pnpm is not installed, bootstrap the pinned version with `npm install --global pnpm@12.21.0` after `nvm use`. Application dependencies are managed exclusively with pnpm.

Install Docker Engine (or Docker Desktop) with Docker Compose before starting PostgreSQL. Compose runs PostgreSQL 18, waits for its healthcheck, and exposes it only on `127.0.0.1:5432`. The credentials in `.env.example` and `compose.yaml` are for local development only. If port 5432 is occupied, change `POSTGRES_PORT` in `.env` and the port in `DATABASE_URL` together.

Configure the Discord application and authentication secrets using [Authentication and access](docs/authentication.md), then open <http://localhost:3000>. The homepage opens the public feedback feed. Sign in to submit feedback, contribute context, a different view, a suggestion, or a question, react with Agree / Disagree, and edit your own text and optional tags. Filter the discussion by contribution type or official responses. Follow posts and read official-update notifications; community managers can publish responses, change status, correct categories, and use the review queue. Administrator alone does not grant community-manager permission. Share public post and comment links. Administrators can manage the available tags from **Tags** in the navigation. See [Feedback](docs/feedback.md) for tag/category configuration and the current schema. `GET /api/health` checks application liveness without a database query. `GET /api/ready` queries PostgreSQL, returning HTTP 200 with `{"status":"ok"}` when available or HTTP 503 with a generic error when unavailable. Database credentials and driver errors are never returned by this endpoint.

The server creates a shared database connection pool on first use and closes it during Nitro shutdown. It reads `DATABASE_URL` only on the server. The page and liveness endpoint can still run without a database; readiness and database-backed features require one. Authentication requires the configured Discord credentials and Better Auth secret. Local `.env` files are ignored by Git.

PostgreSQL data lives in the Compose-managed `postgres_data` volume. `docker compose stop` / `docker compose start --wait`, `docker compose restart`, and `docker compose down` / `docker compose up -d --wait` preserve it. After a restart, run `docker compose up -d --wait` to wait for readiness. **`docker compose down --volumes` deletes the local database permanently.** Use that only when intentionally resetting local data, then start PostgreSQL and reapply migrations. Do not change the PostgreSQL major version on an existing volume without a database upgrade or dump/restore.

## Commands

| Command                      | Purpose                                                          |
| ---------------------------- | ---------------------------------------------------------------- |
| `pnpm dev`                   | Start the development server.                                    |
| `pnpm lint`                  | Check JavaScript, TypeScript, and Vue script blocks with oxlint. |
| `pnpm lint:fix`              | Apply automatic lint fixes.                                      |
| `pnpm format`                | Format source files and documentation with oxfmt.                |
| `pnpm format:check`          | Check formatting without modifying files.                        |
| `pnpm typecheck`             | Check application, server, tests, and scripts.                   |
| `pnpm test`                  | Run lightweight Node tests without Docker.                       |
| `pnpm test:integration`      | Run isolated PostgreSQL integration suites.                      |
| `pnpm test:e2e`              | Build and run isolated Playwright browser suites.                |
| `pnpm storybook`             | Develop shared and feature UI at localhost:6006.                 |
| `pnpm storybook:build`       | Build the static component catalog.                              |
| `pnpm storybook:typecheck`   | Check stories independently of Nuxt auto-imports.                |
| `pnpm test:ui`               | Build Storybook and run isolated component browser checks.       |
| `pnpm feedback:category ...` | Configure category names, ordering, and availability.            |
| `pnpm auth:role ...`         | Grant or revoke privileged roles as a database operator.         |
| `pnpm layer:new <name>`      | Scaffold a local feature layer with Nuxt's built-in generator.   |
| `pnpm build`                 | Build the SPA and Nitro server for production.                   |
| `pnpm preview`               | Preview the production build locally.                            |
| `pnpm db:generate`           | Generate SQL migrations after adding or changing the schema.     |
| `pnpm db:migrate`            | Apply committed migrations using `DATABASE_URL`.                 |
| `pnpm db:check`              | Check migration history consistency.                             |

Oxlint checks Vue script blocks; `pnpm typecheck` also checks Vue templates.

Shared controls and CSS foundations live in `layers/ui/`, with scoped component styles and colocated Storybook stories. Run `pnpm storybook` to explore them without starting a database or signing in. See [UI development](docs/ui.md) for ownership, styling conventions, and adding stories.

## Testing

`pnpm test` runs lightweight tests without Docker. For database and browser tests, start Docker and install Chromium once:

```sh
pnpm exec playwright install chromium
pnpm test:integration
pnpm test:e2e
```

On Linux, use `pnpm exec playwright install --with-deps chromium` if browser system dependencies are missing. Testcontainers provisions a fresh PostgreSQL 18 container per logical suite; tests need neither Docker Compose nor a configured development database. Independent suites can run in parallel, with a default limit of two. See [Testing](docs/testing.md) for suite ownership, concurrency, and adding tests.

## Example data and starting over

With PostgreSQL running, add a few populated discussions:

```sh
pnpm db:seed
pnpm dev
```

Open <http://localhost:3000/feedback>. The command applies pending migrations and adds three example posts with optional tags, comments covering all four contribution types, and official responses with status changes. Repeating it preserves existing posts and any edits to the examples. Example people are labelled `(example)` and have no login credentials; sign in with your own Discord account to participate.

To start over, stop the application and confirm the database name from `DATABASE_URL` (the default local name is `opine`):

```sh
pnpm db:reset --confirm opine
pnpm db:seed
```

**Reset permanently removes all Opine data, including users, sessions, roles, feedback, follows, notifications, and configured categories and tags.** It restores the General feedback category and the five initial tags, retaining the migrated schema and migration history. Sign in again and reassign administrator/community-manager roles after resetting. Reload open pages after resetting; form input is kept only in memory.

Both commands read `.env`; an exported `DATABASE_URL` takes precedence. Check its target before resetting. The confirmation must match the connected database name. Omitting confirmation prints usage and makes no changes. Unrelated tables are left alone; unexpected foreign keys into Opine tables cause reset to fail atomically.

## Database migrations

Drizzle Kit reads `.env` through `drizzle.config.ts`; an exported `DATABASE_URL` takes precedence. The server and migration commands use the same URL. The committed migrations create authentication, session, rate-limit, role, category, tag, post-tag, post, follow, comment, reaction, official-response, notification, and category-audit tables. A fresh installation starts with a General feedback category and Gameplay, UI, Class-specific, Combat, and $$$ tags. Existing posts gain no tags automatically. The contribution-type migration preserves older comments as Unspecified instead of guessing their classification. Migration `0006_remove_write_receipts.sql` removes obsolete retry bookkeeping while retaining feedback content. Later features extend this history.

For each schema change:

1. Edit the owning feature's `layers/<feature>/server/schema.ts`. Re-export new tables and relations from `server/db/schema.ts`, the shared entrypoint for Drizzle and migration tooling.
2. Run `pnpm db:generate --name=describe_the_change`.
3. Review the generated SQL under `drizzle/`, including any data-loss implications. Commit the SQL and generated `drizzle/meta/` snapshots and journal together with the schema change.
4. Run `pnpm db:check` to check migration history consistency, then `pnpm db:migrate` against your local database.
5. Run `pnpm test:integration` to apply the committed migrations to a fresh test database and check database behavior.

Run `pnpm db:migrate` again to verify that applied migrations are not rerun. Test migrations on a fresh database as well as existing data. `db:check` checks migration files, not database connectivity or schema drift. Do not edit already-applied migrations or use `drizzle-kit push` for shared databases; generate a new reviewed migration instead. Migrations are an explicit command and never run automatically on server startup.

Production runs with `node .output/server/index.mjs` after `pnpm build`. Keep the Nitro server in the deployment: the SPA will use it for authentication and database access. Supply production environment variables through the deployment environment; the built server does not load `.env` automatically. Apply committed migrations as a deployment step before starting the new server. For a local production smoke test, use `node --env-file=.env .output/server/index.mjs`, then request `/api/ready`.

## Folder structure

Opine uses feature modules with vertical slices. See [Architecture](docs/architecture.md) for ownership, dependency rules, and a worked feature example. Feature layers are added as their implementation steps begin.

```text
app/
  app.vue                    Application shell
  pages/                     Root route redirect
  components/                Application shell components, when needed
  composables/               Client-side Vue helpers
  spa-loading-template.html  Initial SPA loading state
server/
  api/                       Operational endpoints (health and readiness)
  db/                        Database client, colocated tests, schema aggregation
  plugins/                   Server lifecycle hooks
layers/<feature>/            Feature modules, introduced with their implementation
  nuxt.config.ts             Nuxt layer registration
  app/                       Feature pages, components, and composables
  server/                    Feature endpoints, use cases, schema, and tests
  shared/                    Browser-safe feature contracts and validation
layers/ui/                   Shared controls, scoped styles, tokens, and stories
.storybook/                  Isolated Vue previews and component browser checks
shared/                      Contracts genuinely shared across features and runtimes
drizzle/                     Committed SQL migrations
tests/                       Shared test harness, suite catalog, browser smoke tests
scripts/                     Operator commands and database-backed test runner
docs/                        Architecture, authentication, feedback, testing, and checklist
public/                      Static public assets
compose.yaml                 Local PostgreSQL service and persistent volume
drizzle.config.ts            Database tooling configuration
nuxt.config.ts               Nuxt application configuration
```

The tree includes planned feature locations; no empty feature layers are required. Keep credentials, database clients, and authentication configuration in server code. Node-compatible tests live alongside the code they exercise. `pnpm test` discovers lightweight tests recursively; database-backed suites are listed explicitly in `tests/suites.ts`.

## Product scope and design

- [Requirements](requirements.md)
- [User journeys](journeys.md)
- [Approved visual direction](docs/design/README.md)
- [Interaction reference](example.png) — contribution types, official-response separation, and discussion navigation; see requirements for the included parts.

The core feedback loop is implemented: proposals, typed contributions and filters, official responses and statuses, review queues, follows, notifications, and admin-defined author-selected tags. Agree / Disagree reactions remain secondary.

Next is basic moderation limited to CM lock/unlock and archive actions on whole posts, starting with a schema and visibility-rule review. Archived content disappears from application queries and notifications; no unarchive UI is planned for this release. Remaining release work also covers community configuration, production operation and backup restoration, the operator account-retention process, accessibility and release verification, and an open-source license before repository publication. Follow [steps 6–9 and the publication checklist](docs/TODO.md#6-add-basic-moderation--next) for the implementation sequence.

The [deferred features](requirements.md#explicitly-deferred) are outside this release, including reports, suspensions, moderation history/appeals, individual contribution hiding, summaries/highlights, nested replies, tag filtering, duplicate handling, Discord bots and external notifications. CI remains deferred; local validation and release-readiness checks still apply.
