# Architecture

Opine is one Nuxt SPA and Nitro server application with one PostgreSQL database. We organize product capabilities into mostly self-contained feature modules and implement behavior as vertical slices: the code needed for a use case stays close together within its feature.

The [requirements](../requirements.md) define the product boundary, and [TODO.md](TODO.md) defines the implementation sequence. The concise contributor rules live in [AGENTS.md](../AGENTS.md).

## Feature modules

Use local Nuxt layers under `layers/<feature>/` to keep a feature's UI, endpoints, use cases, schema, contracts, and tests together. Each layer has a minimal `nuxt.config.ts` exporting `defineNuxtConfig({})`; Nuxt automatically registers local layers. The implemented layers are [authentication](../layers/auth/README.md) and [feedback](../layers/feedback/README.md). Create subsequent layers when their capabilities are implemented, without empty scaffolding in advance.

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

### Current feedback layout

```text
layers/feedback/
  nuxt.config.ts
  app/
    pages/feedback/          Public list/detail and authenticated entrypoints
    components/              Rendering, focus, and user events
    composables/             Feature workflows, forms, and request state
    api/                     Typed browser HTTP operations and error decoding
    utils/                   Pure form transformations
  server/
    api/feedback/            HTTP entrypoints
    posts.ts                 Creation and public queries
    participation.ts         Comments, reactions, and author edits
    writes.ts                Atomic mutations and retry receipts
    http.ts                  Authenticated HTTP boundary and error mapping
    categories.ts            Category reads and operator configuration
    tags.ts                  Administrator vocabulary and post tag assignments
    list-input.ts            Filter and pagination validation
    schema.ts                Feedback and participation tables
    posts.integration.ts     Database behavior tests
  shared/
    post-input.ts            Browser-safe submission validation
    participation-input.ts   Comment, reaction, and edit validation
    status.ts                Status values and labels
    contracts.ts             Public serialized response types
  tests/                     Fixtures and browser journeys
```

Split `posts.ts` into individual use-case files when its size or complexity warrants it; vertical slices do not require a file per function.

Nuxt layers merge into a single application. They provide physical grouping, while our import and naming conventions establish module boundaries. Use distinct feature routes and component names; do not use layer precedence to override another feature's implementation. See the official [layer structure](https://nuxt.com/docs/4.x/directory-structure/layers) and [layer priority](https://nuxt.com/docs/4.x/getting-started/layers#layer-priority) documentation.

## Shared UI

The local `layers/ui/` Nuxt layer owns reusable presentation: design tokens, global document defaults, and shared controls with colocated scoped CSS and stories. It is a shared dependency of feature layers and has no dependencies on product features, server code, authentication, or data fetching. The application shell remains in root `app/`. Feedback-specific components remain in the feedback layer, even when they have Storybook stories. See [UI development](ui.md) for the component and styling conventions.

Storybook uses Vue/Vite to render the same components with deterministic props, slots, and events. It loads the UI layer's CSS directly, without starting Nuxt or PostgreSQL. Components intended for isolated stories import their Vue APIs and child components explicitly; application integration remains covered by Nuxt typechecking, builds, and browser journeys.

## A vertical slice: create feedback

The feature's `new.vue` page renders the submission form. `useFeedbackSubmission` owns its validation, in-memory form state, and same-page retry lifecycle; `app/api/posts.ts` sends the typed `POST /api/feedback/posts` request. The endpoint reads the request and authenticated session and delegates creation to `server/posts.ts`.

These browser folders separate responsibilities within the feature, without adding another Nuxt layer or a generic service framework. Simple reads may stay in pages. Post and comment editors accept their own domain contracts, and independent reads and writes keep separate loading/error states. See [UI development](ui.md) for component conventions.

The create operation owns authoritative input validation, participation authorization, and the transaction that writes the post and its initial follow. It returns the result needed by the endpoint. Client-side validation can reuse browser-safe input rules, but server validation and authorization remain mandatory. Creation, follow controls, and notifications are implemented. Optional tags belong to the feedback feature; their vocabulary and assignment use cases share the existing post transaction and author edit version.

Keep the operation's Drizzle queries near that behavior. Introduce a helper, service, or repository only when it makes existing code easier to understand or removes meaningful duplication. A small endpoint may contain its entire operation without an extra wrapper.

`shared/post-input.test.ts` verifies submission validation; `server/posts.integration.ts` exercises transactions and database behavior. Browser journeys use `*.e2e.ts` and cover HTTP authorization as well as the interface. Keep feature-specific tests within their owning feature and register database-backed files in an appropriate suite.

## Dependencies and runtime boundaries

- Root `app/` owns the application shell; `layers/ui/` owns reusable presentation. Root `server/` owns database infrastructure, lifecycle hooks, and operational endpoints.
- Features may consume shared infrastructure and another feature's intentional public functions or contracts. Use explicit imports and keep cross-feature dependencies acyclic. Document the public entrypoints and dependencies in a feature README when it exposes behavior to other features; no mandatory barrel or interface layer is required.
- Keep cross-feature writes behind the owning feature's operations. A cross-feature read or foreign key may reference an explicitly exported schema definition when needed. Schema access must not bypass the owning feature's authorization rules.
- Keep business logic out of globally auto-imported utility folders. Use relative imports within a feature and explicit, verified paths between modules. Verify generated aliases against the installed Nuxt version before using them for cross-feature imports.
- Browser code must never import server modules. Feature `shared/` contains only runtime-independent, browser-safe contracts or validation; it must not import Vue or Nitro runtime code, database schemas or clients, credentials, or server authorization logic.
- Root `shared/` is reserved for concrete reuse across features and runtimes. Keep code in its owning feature until sharing has a demonstrated benefit.

The separation of `app/`, `server/`, and `shared/` remains inside each feature. See Nuxt's [shared directory rules](https://nuxt.com/docs/4.x/directory-structure/shared) and [layer aliases](https://nuxt.com/docs/4.x/directory-structure/layers#automatic-aliases).

## Atomicity and authorization

An HTTP handler can pause between database operations; one request is not automatically one atomic transaction. A transaction commits its enclosed database changes together, while idempotency receipts protect against repeating the same write after a retry. Neither makes an earlier permission check remain valid.

Resolve the session at the HTTP boundary, then check mutable role authority within the use-case transaction. Lock the relevant identity rows so role revocations and protected writes have a defined order. Operations that lock several identities use a consistent order to avoid cross-request deadlocks. Keep these guarantees close to the owning use case; do not hold a transaction open while receiving an HTTP body or contacting an external provider. See [authentication](authentication.md#administrator-role-management) and [feedback concurrency](feedback.md#persistence-and-concurrency) for their concrete contracts.

## Database ownership and migrations

Each feature defines its tables and relations in `layers/<feature>/server/schema.ts`. Root `server/db/schema.ts` re-exports them for both the shared Drizzle client and Drizzle Kit. It contains no table definitions or feature behavior. It currently re-exports authentication and feedback tables.

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

These are shared operational concerns and remain at the root. The connection pool and operational endpoints need no feature layer. Authentication owns `layers/auth/`; feedback owns `layers/feedback/`.

## Tests and verification

Colocate Node-compatible tests with their implementation. Keep them outside framework discovery folders such as `app/pages/`, `server/api/`, `server/routes/`, and `server/plugins/`, where a test could otherwise be registered as an application entrypoint. Tests for an endpoint can live next to its use-case code or in a feature-local `tests/` directory. Shared test infrastructure and the initial application-wide browser smoke suite live under root `tests/`.

Use `*.test.ts` for lightweight Node tests, `*.integration.ts` for database integration tests, and `*.e2e.ts` for Playwright browser journeys. Lightweight tests use Node's recursive discovery without Docker or `.env` loading. Node tests run without Nuxt auto-imports or aliases; use explicit imports and Node-compatible code.

[Testing](testing.md) owns the suite-isolation, lifecycle, concurrency, and restart-scenario rules. Run lint, formatting checks, typecheck, build, and relevant tests for code changes; verify formatting and links for documentation changes.

## Documentation ownership

Keep architecture and module boundaries here. Feature READMEs list ownership and public entrypoints; link from them to canonical domain behavior rather than repeating locks, compatibility policies, and retention rules. [UI development](ui.md) owns component/workflow conventions, [Testing](testing.md) owns verification practices, and [requirements](../requirements.md) owns product scope. Contributor instructions should point to these documents. Completed implementation plans belong in Git history rather than a second set of current rules.
