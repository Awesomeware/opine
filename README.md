# Opine

Opine is an open-source community feedback tool for players and community managers. Its visual identity is an **o followed by a pine tree mark**.

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
pnpm dev
```

If pnpm is not installed, bootstrap the pinned version with `npm install --global pnpm@12.21.0` after `nvm use`. Application dependencies are managed exclusively with pnpm.

Open <http://localhost:3000>. The skeleton displays a simple Hello World page and exposes `GET /api/health` as an application liveness endpoint.

The skeleton runs without PostgreSQL or Discord credentials. Database and authentication dependencies are installed; application tables and the sign-in flow will be implemented with their features. `.env.example` lists the settings reserved for that work. Local `.env` files are ignored by Git.

## Commands

| Command             | Purpose                                                          |
| ------------------- | ---------------------------------------------------------------- |
| `pnpm dev`          | Start the development server.                                    |
| `pnpm lint`         | Check JavaScript, TypeScript, and Vue script blocks with oxlint. |
| `pnpm lint:fix`     | Apply automatic lint fixes.                                      |
| `pnpm format`       | Format source files and documentation with oxfmt.                |
| `pnpm format:check` | Check formatting without modifying files.                        |
| `pnpm typecheck`    | Check application and server TypeScript.                         |
| `pnpm build`        | Build the SPA and Nitro server for production.                   |
| `pnpm preview`      | Preview the production build locally.                            |
| `pnpm db:generate`  | Generate SQL migrations after adding or changing the schema.     |
| `pnpm db:migrate`   | Apply committed migrations using `DATABASE_URL`.                 |
| `pnpm db:check`     | Check migration history consistency.                             |

Oxlint checks Vue script blocks; `pnpm typecheck` also checks Vue templates.

Drizzle Kit reads `.env` through `drizzle.config.ts`. The initial schema is empty; no database migrations have been generated yet. Review and commit generated SQL migrations before applying them.

Production runs with `node .output/server/index.mjs` after `pnpm build`. Keep the Nitro server in the deployment: the SPA will use it for authentication and database access. Supply production environment variables through the deployment environment.

## Folder structure

```text
app/
  app.vue                    Application shell
  pages/                     Page components
  components/                Reusable UI components
  composables/               Client-side Vue helpers
  spa-loading-template.html  Initial SPA loading state
server/
  api/                       Nitro HTTP endpoints
  db/schema.ts               PostgreSQL table definitions
  utils/                     Server-only database and authentication helpers
shared/
  types/                     Types safe to share between browser and server
drizzle/                     Committed SQL migrations
public/                      Static public assets
drizzle.config.ts            Database tooling configuration
nuxt.config.ts               Nuxt application configuration
```

Placeholder directories are reserved for these responsibilities. Keep credentials, database clients, and authentication configuration in server code.

## Product scope and design

- [Requirements](requirements.md)
- [User journeys](journeys.md)
- [Primary visual reference](example-simplified.png)

The first version centers on feedback posts, experience confirmations, flat discussion, official responses, and a community-manager work queue. See the requirements for release boundaries and deferred features.
