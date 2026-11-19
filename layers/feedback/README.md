# Feedback feature

This layer owns categories, posts, follows, comments, reactions, and write receipts. Its schema lives in `server/schema.ts`, aggregated by the root database schema. It consumes the shared database pool and auth's public identity/session entrypoints. The approved schema and local operations are described in [Feedback](../../docs/feedback.md).

## Public entrypoints

- `GET /api/feedback/categories` lists categories in configured order, including inactive categories needed for browsing older feedback.
- `GET /api/feedback/posts` lists public posts newest first. It accepts `q`, category slug, status, `limit` (1–50, default 20), and an opaque cursor. Search is a case-insensitive literal substring of the title or description, including literal `%` and `_` characters. Results contain an excerpt and public author name, without private account fields.
- `GET /api/feedback/posts/:id` returns the public post, its category, and the author's current display name. Invalid or missing IDs return 404.
- `POST /api/feedback/posts` requires a member session and the configured same-origin `Origin` header, plus a UUID `Idempotency-Key`. It accepts only title, description, optional suggested improvement, and category ID. The server supplies author, status, identity, and timestamps. Success returns 201 with `{ id }`.

The `server/posts.ts` functions are internal use cases. In particular, `createPost` expects an already-authenticated internal user ID and validated input; it must not be exposed directly to arbitrary client-supplied authors. Future features must preserve this boundary.

`shared/post-input.ts` owns browser-safe validation and limits. `shared/contracts.ts` describes the serialized public responses; database types remain derived from Drizzle. Server-only `list-input.ts` validates filters and decodes the pagination cursor before any SQL query.

Additional endpoints:

- `PATCH /api/feedback/posts/:id` accepts title, description, optional desired improvement, and loaded version. Only the author may edit text; category/status are forbidden.
- `GET /api/feedback/posts/:id/comments` accepts optional `type` (`context`, `different_view`, `suggestion`, `question`), an opaque cursor, and limit (1–50, default 20). Type filtering happens before chronological pagination. Omitting type includes legacy unclassified comments.
- `GET /api/feedback/posts/:id/comments/:commentId` resolves a direct comment link without loading preceding pages.
- `POST /api/feedback/posts/:id/comments` requires body text, at most 10,000 characters, and one of the four contribution types.
- `PATCH /api/feedback/posts/:id/comments/:commentId` accepts body, loaded version, and optional type; only its author may edit it. Omitted type preserves the current value, including legacy NULL; explicit NULL is rejected.
- `GET /api/feedback/posts/:id/reactions` returns separate agree/disagree counts and the current viewer's choice.
- `PUT /api/feedback/posts/:id/reactions` accepts `kind: 'agree' | 'disagree' | null`, explicitly setting or removing the member's reaction.

All writes require a member session, the configured origin, and a UUID idempotency key. Viewer-aware reads are `no-store`; public projections expose `canEdit` rather than user IDs. Input validators live in `shared/participation-input.ts`; `shared/contribution-types.ts` owns type values, labels, and prompts. The page uses `?contribution=<type>` for its filter and a separate `comment` query parameter for a direct link. A linked contribution outside the selected filter is resolved independently and labelled accordingly. HTTP entrypoints use `server/http.ts`; use cases in `server/participation.ts` enforce ownership. `server/writes.ts` owns the common transaction and receipt logic.

## Persistence and concurrency

Creation inserts the post and its author follow in one transaction. Category selection takes a shared row lock so disabling a category cannot race past creation's availability check. Submissions by one author lock that user's row, making the successful-post rate limit effective across concurrent requests and application instances.

Author and category references use restrictive deletion. Removing authentication credentials or a session does not remove posts. Post and comment authors use restrictive foreign keys. A user record with contributions cannot be physically deleted until an explicit retention/anonymization workflow is implemented. Disabling a category preserves its existing posts. Posts with comments cannot be physically deleted. Removable follows and reactions cascade on post/user deletion; private write receipts cascade on user deletion. No public delete operation exists in this step.

Post pagination orders by `(created_at DESC, id DESC)` and fetches one extra row to determine whether another page exists. Feedback timestamps use millisecond precision to match JavaScript dates exactly; cursor serialization must not discard stored timestamp precision. Reset the cursor when filters change. Public list/detail responses explicitly select public fields rather than serializing user rows.

Comment pagination orders by `(created_at ASC, id ASC)`, with type filtering applied before the limit. Migration `0003_contribution_types.sql` leaves existing comments unclassified (NULL), displayed as Unspecified. New submissions must select a type; do not infer one from old text.

Write receipts use `(actor_id, request_id)` as their primary key. An actor row lock serializes concurrent requests; mutation and receipt commit atomically. Authorization precedes replay, replay precedes rate and version checks, and changed input with an existing key conflicts. Receipt hashes include operation and target. Results contain resource IDs/versions only; never retain previous text. Keep receipts until an explicit retention decision, since expiring them weakens retry guarantees.

Body-only pre-upgrade create requests have a replay-only path: authenticate, authorize, and recover a matching receipt, or reject the missing type. This path must never insert a new untyped contribution. New receipt fingerprints include type; edit omission remains distinct from an explicit type selection.

Edits compare the loaded version before changing current content. Actual text or type changes increment the version and set `edited_at`; no-op saves leave both unchanged. There are no revision tables. Author edits never change category/status. Comments, reactions, and edit limits count persisted requests and survive restarts. Reaction counts do not affect feedback ordering.

## Planned and deferred behavior

Required contribution types, tailored composer guidance, labels, and full-discussion type filters are implemented. Team responses joins the filters in #5; official responses must remain an explicit CM operation, not a member contribution type. The prominent status and featured official-response panel also arrive in #5. Keep the proposal distinct and Agree / Disagree secondary. See [requirements](../../requirements.md) for the agreed product scope. Summaries, curated highlights, nested replies, and separate conversation threads remain deferred.

The author follow is persisted now; follow/unfollow controls and notifications arrive in TODO #5. Status changes and official responses arrive in #5. Moderation and account anonymization must be implemented before the public pilot. Never infer moderation or official-response authority from the administrator role.

Keep request keys and drafts scoped to the current account and operation. Disable duplicate clicks while requests are in flight. Retry an uncertain write with its original key and payload; do not turn an uncertain reaction into a toggle or overwrite an edit conflict without explicit review.
