# Feedback feature

This layer owns categories, posts, follows, comments, reactions, official responses, notifications, category-change audit records, and write receipts. Its schema lives in `server/schema.ts`, aggregated by the root database schema. It consumes the shared database pool and auth's public identity/session entrypoints. The approved schema and local operations are described in [Feedback](../../docs/feedback.md).

## Browser workflows

Components render forms and feedback, manage focus, and emit events. Feature-local `app/composables/` owns submission, explicit post/comment editing, discussion, and management workflows. `app/api/` owns typed HTTP calls; `app/utils/` contains pure form conversions. These remain internal to this feature.

Create request scopes during setup. Mount account/resource workflows with stable identities and remount when those identities change; submission watches session changes explicitly. Each independent read stream invalidates stale results without cancelling committed server writes. Read errors and mutation outcomes remain separate, so a failed refresh can be retried without repeating a confirmed write. See [UI conventions](../../docs/ui.md) and the [cleanup verification](../../docs/vue-refactor.md).

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

Post list/detail results include `tags`. Create input may omit `tagIds` for an empty selection; edit omission preserves existing assignments, while `[]` clears them. Normalize supplied IDs as a sorted set without changing legacy omitted-field fingerprints. Lock selected tag rows while validating availability. Disabled tags may be retained or removed on existing posts, never newly added. Text and assignment edits share one version and transaction; public reads must return a coherent snapshot. Vocabulary management never grants authority to edit other authors' posts. See [tag administration](../../docs/feedback.md#tags).

Official workflow endpoints (implemented in `server/outcomes.ts`):

- `GET /api/feedback/posts/:id/outcome` returns current `status`, workflow `version`, `latestResponse`, the latest status-changing `statusResponse`, viewer `following`, and `canRespond`.
- `POST /api/feedback/posts/:id/responses` requires current community-manager access and `{ body, version, status? }`. It returns `{ id, version }`; omitted status preserves the current status. Ordinary privileged comments are never automatically official.
- `GET /api/feedback/posts/:id/responses/:responseId` returns the immutable public response for direct links.
- `GET /api/feedback/posts/:id/discussion` merges comments and official responses chronologically. Optional `type` accepts the four ordinary types or `team`; omission selects All. It returns discriminated `entries` and `nextCursor`; each source is bounded before merging. The older comments API still returns only comments.
- `PUT /api/feedback/posts/:id/follow` accepts `{ following: boolean }` and sets the member's subscription explicitly.
- `GET /api/feedback/notifications` is private to the session owner. It accepts `unread=true|false`, cursor, and limit; returns notifications and the owner's total `unreadCount`. `PATCH /api/feedback/notifications/:notificationId` accepts `{ read: true }` and cannot read another member's item.
- `GET /api/feedback/review` requires community-manager access. It accepts category slug, status (default `new`, or `all`), `followUp=true|false`, cursor, and limit. Results are oldest-first. Follow-up requires an ordinary comment newer than the latest response, from an author who is not currently a community manager; unanswered posts are excluded.
- `PATCH /api/feedback/posts/:id/category` requires community-manager access and `{ categoryId, version }`; only active destination categories are accepted. `GET /api/feedback/posts/:id/category-history` exposes the bounded operational audit to community managers.

`shared/outcome-input.ts` validates official response, follow, read, and category commands. All new lists default to 20 and cap HTTP page sizes at 50. Direct official links use `?response=<id>#response-<id>` and resolve independently of discussion filters.

All writes require a member session, the configured origin, and a UUID idempotency key. Viewer-aware reads are `no-store`; public projections expose `canEdit` rather than user IDs. Input validators live in `shared/participation-input.ts`; `shared/contribution-types.ts` owns type values, labels, and prompts. The page uses `?contribution=<type>` for its filter and a separate `comment` query parameter for a direct link. A linked contribution outside the selected filter is resolved independently and labelled accordingly. HTTP entrypoints use `server/http.ts`; use cases in `server/participation.ts` enforce ownership. `server/writes.ts` owns the common transaction and receipt logic.

## Persistence and concurrency

Creation inserts the post, tag assignments, and its author follow in one transaction. Category selection takes a shared row lock so disabling a category cannot race past creation's availability check. Submissions by one author lock that user's row, making the successful-post rate limit effective across concurrent requests and application instances.

Author and category references use restrictive deletion. Removing authentication credentials or a session does not remove posts. Post and comment authors use restrictive foreign keys. A user record with contributions cannot be physically deleted until an explicit retention/anonymization workflow is implemented. Disabling a category preserves its existing posts. Posts with comments cannot be physically deleted. Removable follows and reactions cascade on post/user deletion; private write receipts cascade on user deletion. No public delete operation exists in this step.

Post pagination orders by `(created_at DESC, id DESC)` and fetches one extra row to determine whether another page exists. Feedback timestamps use millisecond precision to match JavaScript dates exactly; cursor serialization must not discard stored timestamp precision. Reset the cursor when filters change. Public list/detail responses explicitly select public fields rather than serializing user rows.

Comment pagination orders by `(created_at ASC, id ASC)`, with type filtering applied before the limit. Migration `0003_contribution_types.sql` leaves existing comments unclassified (NULL), displayed as Unspecified. New submissions must select a type; do not infer one from old text.

Write receipts use `(actor_id, request_id)` as their primary key. An actor row lock serializes concurrent requests; mutation and receipt commit atomically. Authorization precedes replay, replay precedes rate and version checks, and changed input with an existing key conflicts. Receipt hashes include operation and target. Results contain resource IDs/versions only; never retain previous text. Keep receipts until an explicit retention decision, since expiring them weakens retry guarantees.

Body-only pre-upgrade create requests have a replay-only path: authenticate, authorize, and recover a matching receipt, or reject the missing type. This path must never insert a new untyped contribution. New receipt fingerprints include type; edit omission remains distinct from an explicit type selection.

Edits compare the loaded version before changing current content. Actual text, tag-selection, or type changes increment the version and set `edited_at`; no-op saves leave both unchanged. There are no revision tables. Author edits never change category/status. Comments, reactions, and edit limits count persisted requests and survive restarts. Reaction counts do not affect feedback ordering.

## Official workflow invariants

Response publication locks the post and compares its separate `workflow_version`; author text edits keep their independent `version`. Response, optional status change, notification fanout, and receipt are atomic. Category correction shares the workflow version but writes a separate audit. Actual status deltas retain previous/new status; unchanged statuses store no delta. Official responses are immutable: corrections publish a new response.

Authorize the current community-manager role before replay inside the actor transaction; administrator alone is insufficient. `FOR NO KEY UPDATE` serializes actor writes while allowing notification foreign-key checks against other active members, and conflicts with role-management locks. Follow writes serialize on the same post lock as publication. Receipt replay returns its old result without reapplying an old subscription state.

Outcome reads use a repeatable-read snapshot. Assign response creation time after the post lock, strictly later than prior responses and comments at millisecond precision; comments created after a response must remain chronologically later even when their transaction started before it. Notifications inherit the response publication time. Never notify for ordinary comments.

## Planned and deferred behavior

Required contribution types, the Official responses filter, prominent official status/response, review queue, following, and in-platform notifications are implemented. Keep the proposal distinct and Agree / Disagree secondary. See [requirements](../../requirements.md) for release scope. Summaries, curated highlights, nested replies, and separate conversation threads remain deferred.

Moderation and account anonymization must be implemented before the public pilot. Never infer moderation or official-response authority from the administrator role. Email, push, and Discord notifications are deferred.

Keep forms and request keys in memory for the current account and mounted operation. Reloading, leaving a form, or cancelling discards unsaved edits; the frontend does not save or restore drafts or pending requests. Disable duplicate clicks while requests are in flight and reuse the key for unchanged same-page retries. Refresh simple controls from the server after uncertain replies. Edit conflicts preserve the currently entered text and require explicit review before retrying against a newer version.
