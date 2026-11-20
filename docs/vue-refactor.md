# Vue workflow cleanup

This cleanup implements the agreed code-quality review. Keep the current feature layers, scoped styling, public API, and product behavior. Do not add dependencies or a general-purpose form/request framework.

## Plan and acceptance criteria

1. Preserve the existing browser coverage for drafts, lost replies, legacy requests, ownership, conflict review, pagination, and direct links. Add regressions for category history refresh failure and an unavailable review-queue category catalog before fixing those paths.
2. Establish blank lines between cohesive blocks, braces around nested control flow, readable templates, and short intent comments. Document reusable workflow contracts, especially identity lifetime, stored data validation, pending writes, and conflicts.
3. Separate post and comment editors with explicit domain contracts. Move editing and submission workflows into feature-local composables; keep UI focus, rendering, and emitted events in components.
4. Extract discussion loading/composition, official publication/following, category correction, tag management, reactions, notifications, and review queue workflows. Use small typed API modules and shared checked error/storage boundaries where there is actual duplication.
5. Keep independent reads and writes independently observable. Standardize stale-read and disposal guards without introducing a universal pagination framework. Preserve account-scoped drafts and exact pending request payloads.
6. Extract contribution rendering from the discussion, remove alias-only loops, and use named event handlers. Keep simple page reads and presentation components straightforward.
7. Run lint, formatting, application/Storybook typechecks, meaningful unit/component tests, full browser journeys, and production builds. Inspect representative rendered pages after template formatting changes.
8. Perform a fresh read-only review after implementation, resolve findings, and commit verified units with concise reason-focused messages.

## Boundaries to preserve

- A write may have committed even when its response is lost. Keep its request key and payload until confirmed or deliberately changed; never automatically replay a mutation on mount.
- Omitted contribution types and tag IDs preserve legacy request fingerprints. An explicit empty tag array clears assignments; omission on edit preserves them.
- A conflict keeps the user's draft and requires explicit review of current saved content before retrying with the new version.
- Components/workflows mounted for one account and resource must not apply old results after disposal or an identity change.
- Reading a direct comment/response link remains independent of discussion filtering and pagination.
- Successful mutation and failed refresh are separate outcomes; a refresh error must not imply that publication failed or erase its own retry path.

## Verification record

The refactor preserves the existing session-storage policy and server receipt contract. Browser state remains in the current tab; there is no offline queue or automatic replay. Persistence for small actions (reactions, follows, notification reads, and administrative forms) is a candidate for a separate simplification. Keeping substantial text drafts does not require persisting every control.

Completed checks:

- 28 lightweight tests, including stored-input/error narrowing, request lifetime, exact pending payloads, invalid receipt keys, editor conversions, and legacy comment text.
- 13 Storybook browser tests, including exact contributed text/whitespace and narrow layouts.
- Application and Storybook typechecks, lint, formatting, and production/Storybook builds.
- Independent review of the Vue workflows and their new boundaries. Review findings about malformed stored requests and legacy JSON-looking comment drafts were resolved.
- 30 application browser tests passed, including the database/application restart phase and new catalog/history/tag-refresh regressions.
- Inspected desktop discussion and narrow feedback screenshots. Explicit byline spacing keeps template formatting from joining names, separators, and dates.
