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
.storybook/
  main.ts
  preview.ts
```

- **Tokens:** centralize semantic colors, fonts, spacing, and radii in `tokens.css`. Both Nuxt and Storybook load this file. Prefer a meaning such as `--color-text-muted` over repeating a raw color in multiple components.
- **Defaults:** keep reset, document typography, link/focus behavior, and native control inheritance in `base.css`. Avoid product-specific selectors and broad visual rules that turn every element into the same widget.
- **Components:** put internal visual rules and responsive behavior in the component's `<style scoped>`. Use props for supported variants, slots for content, and events for interactions. Preserve native attributes and accessible semantics. Parents own placement and spacing between components; avoid styling a child's internals with descendant selectors or `:deep()`.
- **Features:** feedback-specific labels, contribution types, official responses, API calls, and permissions belong to the feedback layer. Generic UI must not import them. Extract shared UI when there is concrete reuse.

Scoped styles prevent a component's selectors from leaking outward, but global CSS and inherited properties can still affect it. Keep global defaults restrained and load exactly the same foundations in Storybook and Nuxt.

## Components and migration

Buttons, status badges, and notices now use `UiButton`, `UiBadge`, and `UiNotice` in the application. `UiButton` defaults to `type="button"`; form actions must explicitly use `type="submit"`. Set `busy` for an operation in progress and `disabled` for an unavailable action. A notice does not announce itself automatically: its caller chooses `role="status"` or `role="alert"` when appropriate.

The [approved visual direction](design/README.md) now drives the shared theme, application shell, feedback list, and discussion. `UiBrand` owns the SVG wordmark; `UiIcon` provides the small decorative symbols used by actions and contribution types. `UiButton` supports primary, quiet, and underline-style filter variants; filter buttons retain `aria-pressed` rather than claiming tab semantics. `FeedbackStatusBadge` owns the mapping from domain statuses to generic badge tones.

`FeedbackPostRow` and `FeedbackOfficialResponse` render from props. Their link slots let the application provide `NuxtLink` while standalone stories use ordinary anchors. Preserve client-side navigation when using these components in Nuxt so local editor and pagination state survives. `FeedbackOutcome` composes its proposal slot, status/follow sidebar, latest response, and manager disclosures; `FeedbackReactions` owns the reaction controls and retry state near the proposal.

Root `app/assets/css/main.css` still contains common page/form layout, legacy form controls, and link-button classes. Shell, feedback row, proposal, discussion, official-response, and contribution-choice styling is scoped to its owner. Existing short color variables remain aliases during migration. As those components are extracted, move their styles beside them and remove the obsolete global rules. Do not load the legacy application stylesheet in Storybook to hide an undeclared component dependency.

## Stories and checks

Colocate `*.stories.ts` with components. Nuxt discovers only Vue component files in these layers; stories are development inputs and must not enter the production component registry. Use stable, realistic fixtures and explicit examples for relevant states such as disabled, busy, error, long content, and narrow layouts. Keep server factories and real account data out of stories.

The catalog includes shared controls, the brand and icons, status tones, feedback rows, official responses, interactive contribution selection, and safe feedback text rendering. Playwright checks component behavior without a database. Storybook stories alone are not screenshot regression tests; approved screenshot baselines and their update workflow remain a separate future addition. The full application E2E suite continues to cover authentication, submission, participation, and official workflows.

References: [Nuxt layers](https://nuxt.com/docs/4.x/getting-started/layers), [Vue scoped CSS](https://vuejs.org/api/sfc-css-features.html), [Storybook for Vue/Vite](https://storybook.js.org/docs/get-started/frameworks/vue3-vite/).
