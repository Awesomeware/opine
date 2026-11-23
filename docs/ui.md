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
layers/feedback/app/
  components/
    FeedbackText.vue
    FeedbackText.stories.ts
  posts/components/
    FeedbackPostRow.vue
    FeedbackPostRow.stories.ts
    FeedbackTagPicker.vue
    FeedbackTagPicker.stories.ts
    FeedbackTags.vue
    FeedbackTags.stories.ts
  discussion/components/
    FeedbackContributionType.vue
    FeedbackContributionType.stories.ts
  review/components/
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

Native checkbox/radio controls have their own restrained defaults; full-width text-field rules must not apply to them. Contribution selectors may keep their intentional overlay styling local.

Use `<UiButton hover-highlight>` for the same subtle background hover treatment
used by quiet actions and discussion filters; it does not add gold text or borders.
Native radio labels can reuse its `ui-hover-highlight` class, as contribution types
do, without replacing radio semantics with buttons. The treatment uses shared theme
tokens, applies only on hover-capable devices, and leaves checked or disabled radio
choices unchanged. Keyboard focus remains a separate visible outline.

Scoped styles prevent a component's selectors from leaking outward, but global CSS and inherited properties can still affect it. Keep global defaults restrained and load exactly the same foundations in Storybook and Nuxt.

## Theme foundations

Set shared colors, font families and weights in `layers/ui/app/assets/css/tokens.css`;
components consume these semantic roles through scoped styles. `base.css` applies
them to document headings, native controls, links, buttons and keyboard focus.

- `--color-accent` is the primary gold (`#f6d16f`): links, primary actions and selected filter underlines. Action tokens derive from it; `--color-selected-background` supplies a subtle selection tint.
- `--color-official` is vivid cyan (`#50e0d5`), paired with `--color-official-background` for official response headings and accents. Keep ordinary reactions neutral.
- `--color-background` (`#101522`), `--color-surface` (`#1b2432`) and the control tokens provide blue-charcoal surfaces. Use text/muted-text tokens for readable hierarchy, and control-border/focus tokens for interactive boundaries.
- `--font-body` uses Source Sans 3; `--font-heading` uses Source Serif 4. Normal, semibold and bold weight tokens provide hierarchy without adding unrelated colors. Variable upright and italic WOFF2 files and their licenses live in [the fonts directory](../layers/ui/app/assets/fonts/README.md). Both builds bundle these local assets; no font service or runtime download dependency is needed.

Use semantic tokens instead of copying palette values into components. The standalone
favicon cannot inherit page CSS, so keep its two colors aligned when changing the theme.
Storybook checks that the fonts actually load and that semantic text, control and focus
color pairs meet the contrast thresholds below.

## Components

Buttons, status badges, and notices now use `UiButton`, `UiBadge`, and `UiNotice` in the application. `UiButton` defaults to `type="button"`; form actions must explicitly use `type="submit"`. Set `busy` for an operation in progress and `disabled` for an unavailable action. A notice does not announce itself automatically: its caller chooses `role="status"` or `role="alert"` when appropriate.

The [approved visual direction](design/README.md) now drives the shared theme, application shell, feedback list, and discussion. `UiBrand` owns the SVG wordmark; `UiIcon` provides the small decorative symbols used by actions and contribution types. `UiButton` supports primary, quiet, and underline-style filter variants; filter buttons retain `aria-pressed` rather than claiming tab semantics. `FeedbackStatusBadge` owns the mapping from domain statuses to generic badge tones.

`FeedbackPostRow` and `FeedbackOfficialResponse` render from props. Their link slots let the application provide `NuxtLink` while standalone stories use ordinary anchors. Preserve client-side navigation when using these components in Nuxt so local editor and pagination state survives. `FeedbackOutcome` composes its proposal slot, status/follow sidebar, latest response, and manager disclosures; `FeedbackReactions` owns the reaction controls and pending state near the proposal.

Root `app/assets/css/main.css` owns application page/form layout. Shared native form controls, field help/errors, and button foundations belong to the UI layer and load in both Nuxt and Storybook. Shell and feature presentation stays scoped to its owner. Do not load the application stylesheet in Storybook to hide an undeclared component dependency.

`FeedbackTagPicker` uses native checkboxes with no default selection. It can retain disabled tags already assigned to a post and expose unavailable saved selections for removal. `FeedbackTags` renders non-interactive pill chips beneath list-row titles and on the proposal. Optional icons use `aria-hidden` so accessible names contain only the tag name; these are distinct from status badges and discussion filters. Both accept data through props and have isolated stories.

## Accessibility

Use native HTML first. Follow the [W3C page structure](https://www.w3.org/WAI/tutorials/page-structure/regions/) and [forms guidance](https://www.w3.org/WAI/tutorials/forms/labels/):

- Each page has one `<main id="main-content" tabindex="-1">`, a descriptive title, and an `h1`. Keep heading levels meaningful within sections. The shell owns the header, footer, labeled navigation, English document language and first-focusable skip link. Use real links for navigation and buttons for actions; never make a clickable `div` imitate a button.
- Use explicit labels, native `required` attributes, and `fieldset`/`legend` for related choices. Associate help and errors through `aria-describedby`; set `aria-invalid` when validation fails. Keep entered values after validation errors and focus the error summary or invalid field. Custom validation forms use `novalidate` so the application can present its complete error summary.
- Keep native keyboard behavior and visible focus. Do not add positive `tabindex` values. Open inline editors at their primary input and return focus when they close. If a refreshed list removes the focused row, move focus to a stable nearby heading or filter. `UiButton` and `UiNotice` expose `focus()` for this purpose; components own focus, not API composables.
- On a pathname change, focus the new main content after rendering. The main container is a navigation target without a page-sized outline; controls, skip links and error summaries retain visible focus. Query/filter changes retain focus on the initiating control. Keep `NuxtRouteAnnouncer` for page-title announcements; it does not move focus. See [Nuxt accessibility](https://nuxt.com/docs/4.x/guide/best-practices/accessibility).
- Prefer native `details`/`summary` for disclosures. Custom disclosure buttons expose `aria-expanded` and `aria-controls`. The archive confirmation is inline content, not a modal dialog: preserve normal tab order and return focus on cancellation.
- Use `role="status"` for concise asynchronous progress/results and `role="alert"` for errors requiring attention. Do not make whole discussions live regions. Keep visual labels for status, official responses and selected actions; color and decorative icons alone cannot convey those states. Filter/reaction buttons use `aria-pressed`; native radios and checkboxes expose their own state.
- Check normal text at 4.5:1 contrast, essential control boundaries and focus indicators at 3:1 against adjacent colors. Decorative separators need not identify a control. Preserve simple reflow without page-level horizontal scrolling at narrow widths. See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

Use existing Storybook controls and application Playwright journeys to verify semantics and keyboard behavior. Automated audits supplement those checks; they do not establish usability with every screen reader or certify WCAG conformance. Record scope and manual interpretations in [release acceptance](release-acceptance.md).

## Vue component readability

Separate imports, props/events, related state, effects, and functions with blank lines. Keep dependent state close to its use rather than enforcing a rigid file-wide ordering. Use braces around nested control flow, named event handlers for coordination, and short intent comments where the reason is not evident from the code. Reusable composables document their lifetime and guarantees.

Complex forms and asynchronous workflows belong in capability-local composables under `app/<capability>/composables`. Components, API calls, and pure form helpers live alongside them in that capability; common request/write/error utilities remain shared within the feedback layer. The component renders state, manages focus, and emits events. Small typed API modules own URLs, methods, and request/response shapes; plain helpers own stateless input conversion. Keep simple `useFetch` reads local when extraction adds no clarity. An ordinary `$fetch` mutation is appropriate inside the operation's API function; automatic refetch must not replay a write.

Use the feedback request-scope helper for manual reads: a new request supersedes the previous result, and disposal invalidates all callbacks. Give independent reads separate scopes and independent operations separate busy/error state. Keep successful writes distinct from failed refreshes. Apply confirmed mutation results, including returned versions, directly to the saved baseline. Refresh parent lists once; a failed list refresh must not block subsequent edits or require a special saved-state recovery flow. Post/account identity is fixed for a mounted workflow; callers key components by identity or explicitly recreate that workflow when it changes.

Keep form input in memory for the current mount. Do not generate request keys or retry mutations automatically. After an uncertain response, tell the user to check saved content before submitting again. Do not save drafts or pending requests in browser storage or restore older browser state. Reloading, leaving a form, cancellation, and account changes may discard unsaved input. Same-page failures retain entered text; conflicts require explicit review of current saved content. API DTOs come from shared contracts, with explicit form conversions.

Vue templates use Oxfmt's whitespace-insensitive layout so nested elements remain readable. `FeedbackText.vue` is deliberately excluded: its adjacent link/text segments must preserve the user's exact whitespace. The component test checks the full text content to protect this exception. Review rendered spacing when changing templates with inline text.

## Stories and checks

Colocate `*.stories.ts` with components. Nuxt discovers only Vue component files in these layers; stories are development inputs and must not enter the production component registry. Use stable, realistic fixtures and explicit examples for relevant states such as disabled, busy, error, long content, and narrow layouts. Keep server factories and real account data out of stories.

The catalog includes shared controls, the brand and icons, status tones, feedback rows, official responses, interactive contribution and optional tag selection, quiet tag labels, and safe feedback text rendering. Playwright checks component behavior without a database. Storybook stories alone are not screenshot regression tests; approved screenshot baselines and their update workflow remain a separate future addition. The full application E2E suite continues to cover authentication, submission, participation, and official workflows.

References: [Nuxt layers](https://nuxt.com/docs/4.x/getting-started/layers), [Vue scoped CSS](https://vuejs.org/api/sfc-css-features.html), [Storybook for Vue/Vite](https://storybook.js.org/docs/get-started/frameworks/vue3-vite/).
