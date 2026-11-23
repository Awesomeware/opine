# Visual direction

The approved [mockup](feedback-direction.png) is the visual reference for the feedback list and discussion. It defines the layout and identity; the approved color and typography refinement below draws on the brighter accents in `example.png` and `example-simplified.png`. The image was generated with the built-in image tool and refined to show the approved logo; its text and controls are illustrative rather than an exact product specification.

## Design rules

- Use an O-shaped gold ring surrounding a pine tree, followed by lowercase **pine**. The complete mark reads **Opine**. Implement the mark as SVG, with an accessible name, rather than embedding the raster mockup.
- The browser favicon in `public/favicon.svg` uses the O-and-tree mark on charcoal, without the wordmark. Keep its geometry and colors aligned with `Brand.vue` and the UI tokens; Nuxt's root config declares the icon.
- Use deep blue-charcoal surfaces, warm ivory text, bright gold participation actions and selected filters, and vivid cyan for official communication. Use self-hosted Source Sans 3 for body text and controls, with Source Serif 4 for headings and the wordmark. Give titles and selected filters bold weight, authors semibold weight, and supporting metadata normal weight. Avoid repeated gradient cards, oversized introductory headings, and decoration that makes unrelated content look equivalent.
- Give the list a compact heading and search/filter toolbar. Feedback entries are rows with separators, a readable title and excerpt, quiet author/date metadata, and a consistent status position. Preserve newest-first ordering, explicit filter application, pagination, and loading/error/empty states.
- Present the author's proposal as open reading text. Place status and follow controls in a supporting desktop column. Show the latest official response above the discussion, using a labelled dark cyan surface and accent rule. Filters must never hide the featured response or current status.
- Use flat contribution entries, a small identifying symbol and explicit type label, and underline-style filter buttons. Filters remain views of one chronological discussion; selection and keyboard focus must remain visible.
- Keep Agree and Disagree neutral and secondary, with separate labelled counts. Use quiet Copy link and edit actions. Give following and adding a typed contribution more emphasis.
- Keep response publication available to community managers through compact disclosure controls. Preserve authorization, validation, clear handling of uncertain responses, conflict review, and explicit publication. Form state follows [UI conventions](../ui.md#vue-component-readability).

## Scope and practical adaptations

Desktop is the priority. Stack columns and wrap controls at narrow widths without adding a separate mobile experience. Preserve accessible names, keyboard interaction, readable contrast, validation feedback, and ordinary content without horizontal page scrolling.

The image's **Implemented** is represented by the existing **Delivered** status. The pictured **Reply** actions are **Comment link** permalinks; nested replies remain deferred. Use **Official response(s)** consistently for explicitly published team communication. The internal `team` discussion-filter value remains compatible with existing URLs. An ordinary comment from a manager is still an ordinary contribution.

Use genuine stored content and dates. Initials may identify contributors decoratively, but do not add profile images, fabricated activity counts, popularity scores, curated summaries, related posts, or new statuses. The existing flat discussion, four required contribution types, plain-text editor, and permission model remain unchanged.

Tags are a subsequent approved scope addition: show author-selected tags as quiet labels on feedback rows and the proposal. Keep them visually distinct from status and contribution types. Selection uses optional checkboxes; tag management is an administrator action.

Moderation and community configuration use this same visual system. Remaining deployment and retention checks are tracked in [the implementation checklist](../TODO.md#10-complete-final-deployment-and-retention-checks). A separate mobile experience and interactive branding editor remain outside the current release.

## Implementation and verification

Shared foundations and controls belong in `layers/ui/`; feature-specific rendering and stories belong in `layers/feedback/`. Keep styling scoped to its owner and remove migrated global rules. See [UI development](../ui.md).

Use deterministic stories for visual states and representative long content. Verify component behavior with `pnpm test:ui`, full journeys with `pnpm test:e2e`, and both application and Storybook typechecks/builds. Inspect fresh desktop screenshots and a narrow-screen layout. Screenshots are review artifacts; this iteration does not establish approved screenshot regression baselines.
