# UI development

Reusable presentation lives in the local Nuxt layer at `layers/ui/`. Nuxt layers explicitly support component libraries; we use that existing application structure rather than introducing a separate workspace package. Product components stay in their owning feature layer. See [Architecture](architecture.md).

## Develop components in isolation

```sh
pnpm storybook
```

Open <http://localhost:6006>. Storybook renders the same Vue components used by the application, with deterministic example data. It does not start Nuxt, authenticate users, or connect to PostgreSQL.

```sh
pnpm storybook:build
pnpm storybook:typecheck
pnpm test:ui
```

The commands build a static catalog in ignored `storybook-static/`, check stories independently of Nuxt's generated types, and build the catalog before running Playwright component checks against its own server. Install Chromium once with `pnpm exec playwright install chromium`. The existing database-backed `pnpm test:e2e` journeys still verify how the controls behave inside the application.

Storybook uses `@storybook/vue3-vite`. This is sufficient for ordinary Vue presentation components and keeps their environment independent of Nuxt. Import Vue functions and child components explicitly in storyable components instead of depending on Nuxt auto-imports. Components needing routing, session state, or API access should keep that integration in their page/container and pass display data and callbacks to the presentation component. If a future story truly needs the Nuxt runtime, add and verify the Nuxt-aware Storybook integration for that case.

## Ownership

```text
layers/ui/
  nuxt.config.ts
  app/assets/css/
    tokens.css
    base.css
  app/components/
    UiButton.vue
    UiButton.stories.ts
    UiBadge.vue
    UiBadge.stories.ts
    UiNotice.vue
    UiNotice.stories.ts
    UiBrand.vue
    UiBrand.stories.ts
    UiIcon.vue
    UiIcon.stories.ts
layers/feedback/app/components/
  FeedbackContributionType.vue
  FeedbackContributionType.stories.ts
  FeedbackText.vue
  FeedbackText.stories.ts
  FeedbackPostRow.vue
  FeedbackPostRow.stories.ts
  FeedbackOfficialResponse.vue
  FeedbackOfficialResponse.stories.ts
  FeedbackStatusBadge.vue
  FeedbackStatusBadge.stories.ts
  FeedbackTagPicker.vue
  FeedbackTagPicker.stories.ts
  FeedbackTags.vue
  FeedbackTags.stories.ts
.storybook/
  main.ts
  preview.ts
```

- **Tokens:** centralize semantic colors, fonts, spacing, and radii in `tokens.css`. Both Nuxt and Storybook load this file. Prefer a meaning such as `--color-text-muted` over repeating a raw color in multiple components.
- **Defaults:** keep reset, document typography, link/focus behavior, and native control inheritance in `base.css`. Avoid product-specific selectors and broad visual rules that turn every element into the same widget.
- **Components:** put internal visual rules and responsive behavior in the component's `<style scoped>`. Use props for supported variants, slots for content, and events for interactions. Preserve native attributes and accessible semantics. Parents own placement and spacing between components; avoid styling a child's internals with descendant selectors or `:deep()`.
- **Features:** feedback-specific labels, contribution types, official responses, API calls, and permissions belong to the feedback layer. Generic UI must not import them. Extract shared UI when there is concrete reuse.

Scoped styles prevent a component's selectors from leaking outward, but global CSS and inherited properties can still affect it. Keep global defaults restrained and load exactly the same foundations in Storybook and Nuxt.

## Components

Buttons, status badges, and notices now use `UiButton`, `UiBadge`, and `UiNotice` in the application. `UiButton` defaults to `type="button"`; form actions must explicitly use `type="submit"`. Set `busy` for an operation in progress and `disabled` for an unavailable action. A notice does not announce itself automatically: its caller chooses `role="status"` or `role="alert"` when appropriate.

The [approved visual direction](design/README.md) now drives the shared theme, application shell, feedback list, and discussion. `UiBrand` owns the SVG wordmark; `UiIcon` provides the small decorative symbols used by actions and contribution types. `UiButton` supports primary, quiet, and underline-style filter variants; filter buttons retain `aria-pressed` rather than claiming tab semantics. `FeedbackStatusBadge` owns the mapping from domain statuses to generic badge tones.

`FeedbackPostRow` and `FeedbackOfficialResponse` render from props. Their link slots let the application provide `NuxtLink` while standalone stories use ordinary anchors. Preserve client-side navigation when using these components in Nuxt so local editor and pagination state survives. `FeedbackOutcome` composes its proposal slot, status/follow sidebar, latest response, and manager disclosures; `FeedbackReactions` owns the reaction controls and retry state near the proposal.

Root `app/assets/css/main.css` owns application page/form layout. Shared native form controls, field help/errors, and button foundations belong to the UI layer and load in both Nuxt and Storybook. Shell and feature presentation stays scoped to its owner. Do not load the application stylesheet in Storybook to hide an undeclared component dependency.

`FeedbackTagPicker` uses native checkboxes with no default selection. It can retain disabled tags already assigned to a post and expose unavailable saved selections for removal. `FeedbackTags` renders non-interactive public labels; these are distinct from status badges and discussion filters. Both accept data through props and have isolated stories.

## Vue component readability

Separate imports, props/events, related state, effects, and functions with blank lines. Keep dependent state close to its use rather than enforcing a rigid file-wide ordering. Use braces around nested control flow, named event handlers for coordination, and short intent comments where the reason is not evident from the code. Reusable composables document their lifetime and guarantees.

Complex forms and asynchronous workflows belong in feature-local composables. The component renders state, manages focus, and emits events. Small typed API modules own URLs, methods, and request/response shapes; plain helpers own stateless input conversion. Keep simple `useFetch` reads local when extraction adds no clarity. An ordinary `$fetch` mutation is appropriate inside the operation's API function; automatic refetch must not replay a write.

Use the feedback request-scope helper for manual reads: a new request supersedes the previous result, and disposal invalidates all callbacks. Give independent reads separate scopes and independent operations separate busy/error state. Keep successful writes distinct from failed refreshes. Apply confirmed mutation results, including returned versions, directly to the saved baseline. Refresh parent lists once; a failed list refresh must not block subsequent edits or require a special saved-state recovery flow. Post/account identity is fixed for a mounted workflow; callers key components by identity or explicitly recreate that workflow when it changes.

Keep form input and unchanged retry keys in memory for the current mount. Do not save drafts or pending requests in browser storage or restore older browser state. Reloading, leaving a form, cancellation, and account changes may discard unsaved input. Same-page failures retain entered text; conflicts require explicit review of current saved content. API DTOs come from shared contracts, with explicit form conversions.

Vue templates use Oxfmt's whitespace-insensitive layout so nested elements remain readable. `FeedbackText.vue` is deliberately excluded: its adjacent link/text segments must preserve the user's exact whitespace. The component test checks the full text content to protect this exception. Review rendered spacing when changing templates with inline text.

## Stories and checks

Colocate `*.stories.ts` with components. Nuxt discovers only Vue component files in these layers; stories are development inputs and must not enter the production component registry. Use stable, realistic fixtures and explicit examples for relevant states such as disabled, busy, error, long content, and narrow layouts. Keep server factories and real account data out of stories.

The catalog includes shared controls, the brand and icons, status tones, feedback rows, official responses, interactive contribution and optional tag selection, quiet tag labels, and safe feedback text rendering. Playwright checks component behavior without a database. Storybook stories alone are not screenshot regression tests; approved screenshot baselines and their update workflow remain a separate future addition. The full application E2E suite continues to cover authentication, submission, participation, and official workflows.

References: [Nuxt layers](https://nuxt.com/docs/4.x/getting-started/layers), [Vue scoped CSS](https://vuejs.org/api/sfc-css-features.html), [Storybook for Vue/Vite](https://storybook.js.org/docs/get-started/frameworks/vue3-vite/).
