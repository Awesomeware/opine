# Feedback feature

This layer owns categories, posts, follows, comments, reactions, official responses, notifications, category-change audit records, and write receipts. Its schema lives in `server/schema.ts`, aggregated by the root database schema. It consumes the shared database pool and auth's public identity/session entrypoints. The approved schema and local operations are described in [Feedback](../../docs/feedback.md).

## Browser workflows

Components render forms and feedback, manage focus, and emit events. Feature-local `app/composables/` owns submission, explicit post/comment editing, discussion, and management workflows. `app/api/` owns typed HTTP calls; `app/utils/` contains pure form conversions. These remain internal to this feature.

Create request scopes during setup. Mount account/resource workflows with stable identities and remount when those identities change; submission watches session changes explicitly. Each independent read stream invalidates stale results without cancelling committed server writes. Read errors and mutation outcomes remain separate, so a failed refresh can be retried without repeating a confirmed write. See [UI conventions](../../docs/ui.md).

## Public entrypoints

- `GET /api/feedback/categories` lists categories in configured order, including inactive categories needed for browsing older feedback.
- `GET /api/feedback/posts` lists public posts newest first. It accepts `q`, category slug, status, `limit` (1–50, default 20), and an opaque cursor. Search is a case-insensitive literal substring of the title or description, including literal `%` and `_` characters. Results contain an excerpt and public author name, without private account fields.
- `GET /api/feedback/posts/:id` returns the public post, its category, and the author's current display name. Invalid or missing IDs return 404.
- `POST /api/feedback/posts` requires a member session and the configured same-origin `Origin` header, plus a UUID `Idempotency-Key`. It accepts only title, description, optional suggested improvement, category ID, and optional tag IDs. The server supplies author, status, identity, and timestamps. Success returns 201 with `{ id }`.

The `server/posts.ts` functions are internal use cases. In particular, `createPost` expects an already-authenticated internal user ID and validated input; it must not be exposed directly to arbitrary client-supplied authors. Future features must preserve this boundary.

`shared/post-input.ts` owns browser-safe validation and limits. `shared/contracts.ts` describes the serialized public responses; database types remain derived from Drizzle. Server-only `list-input.ts` validates filters and decodes the pagination cursor before any SQL query.

Additional endpoints:

- `PATCH /api/feedback/posts/:id` accepts title, description, optional desired improvement, optional tag IDs, and loaded version. Only the author may edit text and tags; category/status are forbidden.
- `GET /api/feedback/posts/:id/comments` accepts optional `type` (`context`, `different_view`, `suggestion`, `question`), an opaque cursor, and limit (1–50, default 20). Type filtering happens before chronological pagination. Omitting type includes legacy unclassified comments.
- `GET /api/feedback/posts/:id/comments/:commentId` resolves a direct comment link without loading preceding pages.
- `POST /api/feedback/posts/:id/comments` requires body text, at most 10,000 characters, and one of the four contribution types.
- `PATCH /api/feedback/posts/:id/comments/:commentId` accepts body, loaded version, and optional type; only its author may edit it. Omitted type preserves the current value, including legacy NULL; explicit NULL is rejected.
- `GET /api/feedback/posts/:id/reactions` returns separate agree/disagree counts and the current viewer's choice.
- `PUT /api/feedback/posts/:id/reactions` accepts `kind: 'agree' | 'disagree' | null`, explicitly setting or removing the member's reaction.

Tag endpoints (implemented in `server/tags.ts`):

- `GET /api/feedback/tags` returns `{ tags }`, including inactive entries for existing assignments. Tags have `id`, `name`, `isActive`, and `version`.
- `POST /api/feedback/tags` requires current administrator access and `{ name }`.
- `PATCH /api/feedback/tags/:id` requires current administrator access and `{ name, isActive, version }`. Tag writes use the same origin, idempotency, and authorization-before-replay rules as other feedback writes.

Post list/detail results include `tags`. See [tag rules and administration](../../docs/feedback.md#tags) for assignment, disabled-tag, version, and omitted-field semantics.

Official workflow endpoints (implemented in `server/outcomes.ts`):

- `GET /api/feedback/posts/:id/outcome` returns current `status`, workflow `version`, `latestResponse`, the latest status-changing `statusResponse`, viewer `following`, and `canRespond`.
- `POST /api/feedback/posts/:id/responses` requires current community-manager access and `{ body, version, status? }`. It returns `{ id, version }`; omitted status preserves the current status. Ordinary privileged comments are never automatically official.
- `GET /api/feedback/posts/:id/responses/:responseId` returns the immutable public response for direct links.
- `GET /api/feedback/posts/:id/discussion` merges comments and official responses chronologically. Optional `type` accepts the four ordinary types or `team`; omission selects All. It returns discriminated `entries` and `nextCursor`; both sources share one consistent snapshot and are bounded before merging. The older comments API still returns only comments.
- `PUT /api/feedback/posts/:id/follow` accepts `{ following: boolean }` and sets the member's subscription explicitly.
- `GET /api/feedback/notifications` is private to the session owner. It accepts `unread=true|false`, cursor, and limit; returns notifications and the owner's total `unreadCount`. `PATCH /api/feedback/notifications/:notificationId` accepts `{ read: true }` and cannot read another member's item.
- `GET /api/feedback/review` requires community-manager access. It accepts category slug, status (default `new`, or `all`), `followUp=true|false`, cursor, and limit. Results are oldest-first. Follow-up requires an ordinary comment newer than the latest response, from an author who is not currently a community manager; unanswered posts are excluded.
- `PATCH /api/feedback/posts/:id/category` requires community-manager access and `{ categoryId, version }`; only active destination categories are accepted. `GET /api/feedback/posts/:id/category-history` exposes the bounded operational audit to community managers.

`shared/outcome-input.ts` validates official response, follow, read, and category commands. All new lists default to 20 and cap HTTP page sizes at 50. Direct official links use `?response=<id>#response-<id>` and resolve independently of discussion filters.

All writes require a member session, the configured origin, and a UUID idempotency key. Viewer-aware reads are `no-store`; public projections expose `canEdit` rather than user IDs. Input validators live in `shared/participation-input.ts`; `shared/contribution-types.ts` owns type values, labels, and prompts. The page uses `?contribution=<type>` for its filter and a separate `comment` query parameter for a direct link. A linked contribution outside the selected filter is resolved independently and labelled accordingly. HTTP entrypoints use `server/http.ts`; use cases in `server/participation.ts` enforce ownership. `server/writes.ts` owns the common transaction and receipt logic.

## Domain rules

[Feedback documentation](../../docs/feedback.md) is the canonical source for schema and behavior:

- [Retention and public attribution](../../docs/feedback.md#contribution-retention).
- [Discussion and reactions](../../docs/feedback.md#discussion-and-reactions).
- [Editing, versions, receipts, and compatibility](../../docs/feedback.md#editing-and-safe-retries).
- [Transactions, locks, snapshots, and ordering](../../docs/feedback.md#persistence-and-concurrency).
- [Posting limits](../../docs/feedback.md#posting-limits).

For product scope and deferred work, see [requirements](../../requirements.md) and [the implementation plan](../../docs/TODO.md). For browser state and request lifetimes, see [UI conventions](../../docs/ui.md#vue-component-readability). Verification commands and suite ownership live in [Testing](../../docs/testing.md).
