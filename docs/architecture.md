# Architecture

Opine is one Nuxt SPA and Nitro server application with one PostgreSQL database. We organize product capabilities into mostly self-contained feature modules and implement behavior as vertical slices: the code needed for a use case stays close together within its feature.

The [requirements](../requirements.md) define the product boundary, and [TODO.md](TODO.md) defines the implementation sequence. The concise contributor rules live in [AGENTS.md](../AGENTS.md).

## Feature modules

Use local Nuxt layers under `layers/<feature>/` to keep a feature's UI, endpoints, use cases, schema, contracts, and tests together. Each layer has a minimal `nuxt.config.ts` exporting `defineNuxtConfig({})`; Nuxt automatically registers local layers. The implemented layers are [authentication](../layers/auth/README.md) and [feedback](../layers/feedback/README.md). Create subsequent layers when their capabilities are implemented, without empty scaffolding in advance.

A feature represents a cohesive product capability. A Nuxt layer can assemble several closely collaborating capabilities: framework registration and domain ownership need not have a one-to-one relationship. Individual actions such as creating feedback or editing a post are slices inside a capability. Add folders and helpers only when the feature needs them.

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

### Feedback capabilities

The feedback layer contains four capability groups. These establish ownership inside the existing layer; they are not separate Nuxt layers or services. Promote a capability to its own layer when its dependencies and public contract support that boundary, rather than to balance folder sizes.

| Capability      | Owns                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------- |
| `posts`         | Post creation, author editing, browsing, categories, tags, and post workflow persistence |
| `discussion`    | Typed comments, comment editing, reactions, and the combined discussion feed             |
| `review`        | Official publication, outcome display, review queue, and audited category corrections    |
| `subscriptions` | Following, notification delivery, and private inbox/read state                           |

```text
layers/feedback/
  nuxt.config.ts
  app/
    pages/feedback/          Route entrypoints and page composition
    posts/                   Components/stories, composables, API calls, form helpers
    discussion/              Components/stories, composables, API calls, form helpers
    review/                  Components/stories, composables, API calls
    subscriptions/           Components, composables, API calls
    components/              Shared feedback text and navigation
    composables/             Shared request lifetime and in-memory write state
    api/errors.ts            Transport error decoding
  server/
    api/feedback/            Stable HTTP entrypoints
    posts/                   Creation, editing, queries, tags, categories, workflow writes
    discussion/              Comments, reactions, combined feed
    review/                  Publication, outcome, queue, category correction, guards
    subscriptions/           Following, notification fanout, inbox
    schema.ts                One schema for this collaborating domain
    write-repository.ts      Actor creation serialization and limits from existing rows
    writes.ts                Shared transaction type, errors and configuration
    http.ts                  Authenticated HTTP boundary and error mapping
    list-input.ts            Shared query validation and pagination
  shared/
    posts/                   Post/tag inputs and response contracts
    discussion/              Comment/reaction inputs, contribution types, feed contracts
    review/                  Official/category inputs and response contracts
    subscriptions/           Follow/read inputs and inbox contracts
    input.ts                 Common validation primitives
    status.ts                Status values shared by posts, review and inbox
  tests/
    posts/                   Authoring and tag browser journeys
    discussion/              Participation and contribution-type browser journeys
    review/                  Official workflow and queue browser journeys
    fixtures.ts              Shared test identities/content setup
    persistence*.ts          Cross-capability restart journey
```

Database integration tests live beside their server capability. Shared validation and pure client conversion tests are colocated with their implementation. Browser journeys that span capabilities live with the initiating workflow. All database files remain in the existing logical suites.

Page/container components compose capabilities through explicit imports and events. Component directories are registered explicitly with `pathPrefix: false`, preserving the existing distinct `Feedback*` names. Shared contracts are imported from their owning capability; there is no catch-all contract barrel.

Nuxt layers merge into a single application. They provide physical grouping, while our import and naming conventions establish module boundaries. Use distinct feature routes and component names; do not use layer precedence to override another feature's implementation. See the official [layer structure](https://nuxt.com/docs/4.x/directory-structure/layers) and [layer priority](https://nuxt.com/docs/4.x/getting-started/layers#layer-priority) documentation.

## Shared UI

The local `layers/ui/` Nuxt layer owns reusable presentation: design tokens, global document defaults, and shared controls with colocated scoped CSS and stories. It is a shared dependency of feature layers and has no dependencies on product features, server code, authentication, or data fetching. The application shell remains in root `app/`. Feedback-specific components remain in the feedback layer, even when they have Storybook stories. See [UI development](ui.md) for the component and styling conventions.

Storybook uses Vue/Vite to render the same components with deterministic props, slots, and events. It loads the UI layer's CSS directly, without starting Nuxt or PostgreSQL. Components intended for isolated stories import their Vue APIs and child components explicitly; application integration remains covered by Nuxt typechecking, builds, and browser journeys.

## A vertical slice: create feedback

The feature's `new.vue` page renders the submission form. `useFeedbackSubmission` owns its validation, in-memory form state, and submission state; `app/posts/api/posts.ts` sends the typed `POST /api/feedback/posts` request. The endpoint reads and validates the request, resolves its authenticated session, and delegates creation to `server/posts/creation.ts`.

These browser folders separate responsibilities within the feature, without adding another Nuxt layer or a generic service framework. Simple reads may stay in pages. Post and comment editors accept their own domain contracts, and independent reads and writes keep separate loading/error states. See [UI development](ui.md) for component conventions.

The HTTP boundary owns input validation and request authorization. The create operation owns the transaction that writes the post and its initial follow. It returns the result needed by the endpoint. Client-side validation can reuse browser-safe input rules, but server validation and authorization remain mandatory. Creation, follow controls, and notifications are implemented. Optional tags belong to the feedback feature; their vocabulary and assignment use cases share the existing post transaction and author edit version.

Keep the operation's Drizzle queries near that behavior. Introduce a helper, service, or repository only when it makes existing code easier to understand or removes meaningful duplication. A small endpoint may contain its entire operation without an extra wrapper.

`shared/posts/input.test.ts` verifies submission validation; `server/posts/posts.integration.ts` exercises transactions and database behavior. Browser journeys use `*.e2e.ts` and cover HTTP authorization as well as the interface. Keep feature-specific tests within their owning feature and register database-backed files in an appropriate suite.

## Operations spanning capabilities

A business use case owns its transaction, including resource ownership checks, data-consistency locks and all dependent writes. Participating functions receive that same transaction explicitly and do not open a second transaction or obtain a separate connection. Keep these functions with the capability that owns the records; use ordinary functions rather than a generic repository hierarchy.

- [Post creation](../layers/feedback/server/posts/creation.ts) calls `replacePostTags(transaction, ...)` and subscriptions' `followPost(transaction, ...)` before committing the new post.
- [Official publication](../layers/feedback/server/review/publication.ts) receives a manager-authorized request and owns the workflow-version check, inserts the response, calls posts' `updatePostWorkflow(transaction, ...)`, and subscriptions' `notifyFollowers(transaction, ...)`. Notification failure rolls back the response, status, and notifications together.
- [Category correction](../layers/feedback/server/review/category-correction.ts) owns the manager decision and audit; the post update participates through the same transaction-taking persistence function.

These persistence helpers assume an authorized use case with the documented locks/version checks; HTTP endpoints must call the use case rather than bypassing it through a helper. Each use case opens an explicit database transaction. Common operations live in `write-repository.ts`: serialize creations by one actor and enforce limits using existing domain rows. These functions receive the transaction and do not run callbacks. Keep ownership checks, version checks and mutations visible in execution order. Unchanged edits return the current version without storing another record.

Read projections belong to the capability presenting the view. The discussion feed may join ordinary comments and official responses; the review queue may query posts and comments; inbox queries may join notification, response, and post tables. Keep multi-query projections in one snapshot where consistency requires it. Shared schema access is explicit and does not authorize cross-capability writes.

The shared schema, focused write repository and HTTP boundary remain inside this collaborating layer. Reuse recurring resource queries in capability-owned repository functions; keep one-off SQL with its use case when extraction would add no clarity. These modules are ordinary functions, with no generic repository base class or application-wide persistence facade. Capability operation imports are acyclic; queries may use the shared schema without importing another capability's mutation coordinator.

## Dependencies and runtime boundaries

- Root `app/` owns the application shell; `layers/ui/` owns reusable presentation. Root `server/` owns database infrastructure, lifecycle hooks, and operational endpoints.
- Features may consume shared infrastructure and another feature's intentional public functions or contracts. Use explicit imports and keep cross-feature dependencies acyclic. Document the public entrypoints and dependencies in a feature README when it exposes behavior to other features; no mandatory barrel or interface layer is required.
- Keep cross-feature writes behind the owning feature's operations. A cross-feature read or foreign key may reference an explicitly exported schema definition when needed. Schema access must not bypass the owning feature's authorization rules.
- Keep business logic out of globally auto-imported utility folders. Use relative imports within a feature and explicit, verified paths between modules. Verify generated aliases against the installed Nuxt version before using them for cross-feature imports.
- Browser code must never import server modules. Feature `shared/` contains only runtime-independent, browser-safe contracts or validation; it must not import Vue or Nitro runtime code, database schemas or clients, credentials, or server authorization logic.
- Root `shared/` is reserved for concrete reuse across features and runtimes. Keep code in its owning feature until sharing has a demonstrated benefit.

The separation of `app/`, `server/`, and `shared/` remains inside each feature. See Nuxt's [shared directory rules](https://nuxt.com/docs/4.x/directory-structure/shared) and [layer aliases](https://nuxt.com/docs/4.x/directory-structure/layers#automatic-aliases).

## Atomicity and authorization

Authorization is request-scoped. Read and validate the complete request, then resolve the session, enforce the configured origin, and check the route's required role before calling a use case. An authorized request may complete after its role is revoked. Subsequent requests, including retries, must authorize again. There are no transactional role rechecks or locks intended to coordinate role revocation.

Resource ownership remains part of the operation: author editing checks the resource owner, and private inbox operations restrict the recipient. Persistence helpers assume their caller has passed the HTTP authorization boundary or is a trusted operator. They do not parse sessions or decide role policy.

Transactions commit dependent database changes together. There are no write receipts or request keys. Actor creation locks serialize cooldown and contribution-limit checks with insertion, while resource locks protect edits, publication ordering, categories and tags. Retain these data guarantees independently of the request-time authorization policy. See [authentication](authentication.md#administrator-role-management) and [feedback concurrency](feedback.md#persistence-and-concurrency).

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
