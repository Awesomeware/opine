# Architecture

Opine is one Nuxt SPA and Nitro server application with one PostgreSQL database. We organize product capabilities into mostly self-contained feature modules and implement behavior as vertical slices: the code needed for a use case stays close together within its feature.

The [requirements](../requirements.md) define the product boundary, and [TODO.md](TODO.md) defines the implementation sequence. The concise contributor rules live in [AGENTS.md](../AGENTS.md).

## Feature modules

Use local Nuxt layers under `layers/<feature>/` to keep a feature's UI, endpoints, use cases, schema, contracts, and tests together. Each layer has a minimal `nuxt.config.ts` exporting `defineNuxtConfig({})`; Nuxt automatically registers local layers. The first implemented layer is [authentication](../layers/auth/README.md). Create subsequent layers when their capabilities are implemented, without empty scaffolding in advance.

A feature represents a cohesive product capability. Individual actions such as creating feedback or editing a post are slices inside that feature, not separate Nuxt layers. Add folders and helpers only when the feature needs them.

### Creating a feature layer

From the repository root, run:

```sh
pnpm layer:new feedback
```

This uses the installed Nuxt CLI's [`nuxt add-template layer <name>`](https://nuxt.com/docs/4.x/api/commands/add-template#nuxt-add-template-layer) command. It creates `layers/feedback/nuxt.config.ts` containing `export default defineNuxtConfig({})`. Nuxt discovers the layer automatically; no root configuration change or separate package installation is needed. Use a descriptive lowercase kebab-case feature name, such as `feedback` or `team-responses`.

The native generator creates only the config. Add `app/`, `server/`, and `shared/` subfolders as their implementation begins. When generating UI files, create `app/` first: the installed CLI otherwise falls back to the older root-level layout in an empty layer. Nuxt's other generators can then create framework entrypoints inside the layer using `--cwd`:

```sh
mkdir -p layers/feedback/app
pnpm exec nuxt add-template page feedback/new --cwd layers/feedback
pnpm exec nuxt add-template api feedback/index --method post --cwd layers/feedback
```

These create `layers/feedback/app/pages/feedback/new.vue` and `layers/feedback/server/api/feedback/index.post.ts`. Keep use-case code and colocated tests outside these route directories, following the layout below. Create `server/schema.ts` when the feature needs tables and re-export them from the root schema. The generator provides a starting layout; the dependency and ownership rules below still apply during implementation and review.

Use the native generator rather than maintaining a parallel `new-layer.sh`. It refuses to overwrite an existing config unless `--force` is explicitly supplied. The old `nuxt add layer` scaffolding syntax is deprecated; use `add-template` or the project shortcut.

### Example layout

This feedback layout is illustrative, not implemented yet:

```text
layers/feedback/
  nuxt.config.ts
  app/
    pages/feedback/
      index.vue
      new.vue
    components/
      FeedbackForm.vue
  server/
    api/feedback/
      index.get.ts
      index.post.ts
    posts/
      create.ts
      create.test.ts
      list.ts
      list.test.ts
    schema.ts
  shared/
    post-input.ts
```

Nuxt layers merge into a single application. They provide physical grouping, while our import and naming conventions establish module boundaries. Use distinct feature routes and component names; do not use layer precedence to override another feature's implementation. See the official [layer structure](https://nuxt.com/docs/4.x/directory-structure/layers) and [layer priority](https://nuxt.com/docs/4.x/getting-started/layers#layer-priority) documentation.

## A vertical slice: create feedback

The feature's `new.vue` page presents `FeedbackForm.vue` and calls `POST /api/feedback`. The endpoint reads the request and authenticated session and delegates substantial behavior to `server/posts/create.ts`.

The create operation owns authoritative input validation, participation authorization, and the transaction that writes the post and its initial follow. It returns the result needed by the endpoint. Client-side validation can reuse browser-safe input rules, but server validation and authorization remain mandatory. The exact implementation follows TODO #3 and the relevant requirements.

Keep the operation's Drizzle queries near that behavior. Introduce a helper, service, or repository only when it makes existing code easier to understand or removes meaningful duplication. A small endpoint may contain its entire operation without an extra wrapper.

`create.test.ts` verifies lightweight behavior; `create.integration.ts` exercises database-backed behavior, including authorization and transactions where applicable. Browser journeys use `*.e2e.ts`. Keep feature-specific tests within their owning feature and register database-backed files in an appropriate suite.

## Dependencies and runtime boundaries

- Root `app/` owns the application shell and genuinely shared presentation. Root `server/` owns database infrastructure, lifecycle hooks, and operational endpoints.
- Features may consume shared infrastructure and another feature's intentional public functions or contracts. Use explicit imports and keep cross-feature dependencies acyclic. Document the public entrypoints and dependencies in a feature README when it exposes behavior to other features; no mandatory barrel or interface layer is required.
- Keep cross-feature writes behind the owning feature's operations. A cross-feature read or foreign key may reference an explicitly exported schema definition when needed. Schema access must not bypass the owning feature's authorization rules.
- Keep business logic out of globally auto-imported utility folders. Use relative imports within a feature and explicit, verified paths between modules. Verify generated aliases against the installed Nuxt version before using them for cross-feature imports.
- Browser code must never import server modules. Feature `shared/` contains only runtime-independent, browser-safe contracts or validation; it must not import Vue or Nitro runtime code, database schemas or clients, credentials, or server authorization logic.
- Root `shared/` is reserved for concrete reuse across features and runtimes. Keep code in its owning feature until sharing has a demonstrated benefit.

The separation of `app/`, `server/`, and `shared/` remains inside each feature. See Nuxt's [shared directory rules](https://nuxt.com/docs/4.x/directory-structure/shared) and [layer aliases](https://nuxt.com/docs/4.x/directory-structure/layers#automatic-aliases).

## Database ownership and migrations

Each feature defines its tables and relations in `layers/<feature>/server/schema.ts`. Root `server/db/schema.ts` re-exports them for both the shared Drizzle client and Drizzle Kit. It contains no table definitions or feature behavior. It currently re-exports the authentication tables.

Schema modules describe the database without opening connections. They must not import the database client, the aggregate schema, or use-case code. For cross-feature foreign keys, import the owning feature's exported schema definition directly, keeping schema dependencies acyclic. This avoids a cycle between schema assembly and the shared client.

All features use the connection pool in `server/db/index.ts`. Keep one reviewed, committed migration history under `drizzle/` because the application has one database and deploys as a unit. Generate and apply migrations explicitly using the [README workflow](../README.md#database-migrations); do not migrate from feature startup hooks.

## Infrastructure established in TODO #1

```text
compose.yaml                 Local PostgreSQL service and persistent volume
server/
  db/
    index.ts                 Shared connection pool and Drizzle client
    db.test.ts               Lightweight configuration and pool lifecycle tests
    db.integration.ts        Isolated database integration suite
    schema.ts                Feature schema aggregation
  plugins/database.ts        Pool shutdown hook
  api/
    health.get.ts            Application liveness
    ready.get.ts             Database readiness
drizzle/                     Application-wide migration history
```

These are shared operational concerns and remain at the root. The connection pool and operational endpoints need no feature layer. Authentication owns `layers/auth/`; feedback will introduce its own layer in TODO #3.

## Tests and verification

Colocate Node-compatible tests with their implementation. Keep them outside framework discovery folders such as `app/pages/`, `server/api/`, `server/routes/`, and `server/plugins/`, where a test could otherwise be registered as an application entrypoint. Tests for an endpoint can live next to its use-case code or in a feature-local `tests/` directory. Shared test infrastructure and the initial application-wide browser smoke suite live under root `tests/`.

Use `*.test.ts` for lightweight Node tests, `*.integration.ts` for database integration tests, and `*.e2e.ts` for Playwright browser journeys. Lightweight tests use Node's recursive discovery without Docker or `.env` loading. Node tests run without Nuxt auto-imports or aliases; use explicit imports and Node-compatible code.

Database-backed files belong to explicit logical suites in `tests/suites.ts`. Each suite gets a fresh PostgreSQL container with committed migrations applied. A suite may include multiple files, so adding a file need not increase container count. Independent suites run in parallel with bounded concurrency; tests within a suite run serially and share its database. Keep suites cohesive and clean up scenario data. Each E2E suite also owns a separate application server.

See [Testing](testing.md) for setup, commands, lifecycle, and adding suites. Run lint, formatting checks, typecheck, build, and relevant tests for code changes; verify formatting and links for documentation changes.
