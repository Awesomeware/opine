# Shared UI

This local Nuxt layer owns shared presentation: tokens and document defaults in `app/assets/css/`, and Vue components with scoped styles and colocated stories in `app/components/`.

The public controls are `Button`, `Badge`, `Notice`, `Brand`, and `Icon`. Nuxt registers them automatically. Shared UI depends only on Vue and browser APIs; it must not depend on feature layers, authentication, API calls, or server code. Domain-specific components stay in their feature layer.

Run `pnpm storybook` from the repository root to explore the controls. See [UI development](../../docs/ui.md) for their contracts, stylesheet ownership, the incremental migration, and verification commands.
