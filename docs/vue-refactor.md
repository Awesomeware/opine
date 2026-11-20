# Vue workflow simplification

Feature-local composables own workflows, typed API modules own transport, and Vue components own rendering, focus, and events. Explicit post/comment editors, readable code blocks, intent comments, and scoped CSS remain the conventions described in [UI development](ui.md).

## Plan and acceptance criteria

1. Remove frontend draft and pending-request persistence, restoration, storage parsing, and legacy browser recovery. Keep forms in memory only; reload, navigation away, cancellation, and account changes can discard unsaved input.
2. Keep request keys in memory for unchanged retries while the current form/action is mounted. Keep validation feedback, duplicate-click prevention, and explicit edit-conflict review. Remove dedicated persisted-request recovery controls.
3. Retain server authorization, validation, transactions, version checks, and duplicate-request receipts. Existing published contributions and server compatibility remain intact.
4. Replace browser restoration tests with checks for discarded unsaved input and same-page retries. Preserve public browsing, typed discussions, management, conflict, and restart coverage.
5. Delete unused parsers, storage helpers, and obsolete tests. Update product and contributor documentation.
6. Run focused tests, lint, formatting, application/Storybook typechecks, builds, UI and application browser suites. Review the final diff independently and commit tested units.

## Verification record

The new memory-only write test first failed against the storage-backed helper and passes after removing its storage access.

- 23 lightweight tests passed, including same-instance key reuse and zero storage access.
- 29 application browser tests passed, including reload/back discard, same-page lost-response retries, edit conflicts, and published-data persistence after database/application restart.
- 13 Storybook browser tests passed.
- Lint, formatting, application/Storybook typechecks, production/Storybook builds, diff checks, and local documentation links passed.
- Independent review found no blocking issues. Mounted workflow versions deliberately require explicit review after conflicting changes, including changes made through another form on the same page.
- No server implementation, schema, migration, or dependency changes were needed.
