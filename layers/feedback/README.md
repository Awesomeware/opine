# Feedback feature

This layer assembles four capability groups: `posts` (authoring, browsing, categories and tags), `discussion` (comments and reactions), `review` (official decisions, queue and whole-post moderation), and `subscriptions` (following and inbox). Its schema lives in `server/schema.ts`, aggregated by the root database schema. It consumes the shared database pool and auth's public identity/session entrypoints. The approved schema and local operations are described in [Feedback](../../docs/feedback.md).

## Browser workflows

Each `app/<capability>/` groups its components/stories, composables, typed API calls, and form conversions. Components render, manage focus, and emit events; composables own workflows. Common text/navigation and request/write/error plumbing stay in the shared `app/components`, `app/composables`, and `app/api` folders. Route pages compose the capabilities. See the [capability layout and transaction boundaries](../../docs/architecture.md#feedback-capabilities).

Create request scopes during setup. Mount account/resource workflows with stable identities and remount when those identities change; submission watches session changes explicitly. Each independent read stream invalidates stale results without cancelling committed server writes. Read errors and mutation outcomes remain separate, so a failed refresh can be retried without repeating a confirmed write. See [UI conventions](../../docs/ui.md).

## Public entrypoints

- `GET /api/feedback/categories` lists categories in configured order, including inactive categories needed for browsing older feedback.
- `GET /api/feedback/posts` lists public posts newest first. It accepts `q`, category slug, status, `limit` (1–50, default 20), and an opaque cursor. Search is a case-insensitive literal substring of the title or description, including literal `%` and `_` characters. Results contain an excerpt and public author name, without private account fields.
- `GET /api/feedback/posts/:id` returns the public post, its category, and the author's current display name. Invalid or missing IDs return 404.
- `POST /api/feedback/posts` requires a member session and the configured same-origin `Origin` header. It accepts only title, description, optional suggested improvement, category ID, and optional tag IDs. The server supplies author, status, identity, and timestamps. Success returns 201 with `{ id }`.

The `server/posts/` functions own post use cases. In particular, `createPost` expects an already-authenticated internal user ID and validated input; it must not be exposed directly to arbitrary client-supplied authors. Future features must preserve this boundary.

`shared/posts/input.ts` owns browser-safe post validation and limits. Each `shared/<capability>/contracts.ts` describes its serialized public responses; database types remain derived from Drizzle. Server-only `list-input.ts` validates feature filters and delegates cursor/page-size validation to root `server/pagination.ts`. Queries reuse its cursor predicates and page helpers; see [server pagination](../../docs/architecture.md#server-pagination).

Additional endpoints:

- `PATCH /api/feedback/posts/:id` accepts title, description, optional desired improvement, optional tag IDs, and loaded version. Only the author may edit text and tags; category/status are forbidden.
- `GET /api/feedback/posts/:id/comments` accepts optional `type` (`context`, `different_view`, `suggestion`, `question`), an opaque cursor, and limit (1–50, default 20). Type filtering happens before chronological pagination. Omitting type includes legacy unclassified comments.
- `GET /api/feedback/posts/:id/comments/:commentId` resolves a direct comment link without loading preceding pages.
- `POST /api/feedback/posts/:id/comments` requires body text, at most 10,000 characters, and one of the four contribution types.
- `PATCH /api/feedback/posts/:id/comments/:commentId` accepts body, loaded version, and optional type; only its author may edit it. Omitted type preserves the current value, including legacy NULL; explicit NULL is rejected.
- `GET /api/feedback/posts/:id/reactions` returns separate agree/disagree counts and the current viewer's choice.
- `PUT /api/feedback/posts/:id/reactions` accepts `kind: 'agree' | 'disagree' | null`, explicitly setting or removing the member's reaction.

Tag endpoints (implemented in `server/posts/tags.ts`):

- `GET /api/feedback/tags` returns `{ tags }`, including inactive entries for existing assignments. Tags have `id`, `name`, `isActive`, and `version`.
- `POST /api/feedback/tags` requires current administrator access and `{ name }`.
- `PATCH /api/feedback/tags/:id` requires current administrator access and `{ name, isActive, version }`. Tag writes require the configured origin and request-time authorization. Names remain unique and edits require the current version.

Post list/detail results include `tags` and nullable `lockedAt`. See [tag rules and administration](../../docs/feedback.md#tags) for assignment, disabled-tag, version, and omitted-field semantics.

Cross-capability endpoints are implemented in `server/review/`, `server/discussion/feed.ts`, and `server/subscriptions/`:

- `PUT /api/feedback/posts/:id/lock` requires community-manager access and `{ locked: boolean }`.
- `POST /api/feedback/posts/:id/archive` requires community-manager access and archives the whole post.
- `GET /api/feedback/posts/:id/outcome` returns current `status`, workflow `version`, `latestResponse`, the latest status-changing `statusResponse`, viewer `following`, `canRespond`, and `canModerate`. A locked post disables response publication without removing CM moderation controls.
- `POST /api/feedback/posts/:id/responses` requires current community-manager access and `{ body, version, status? }`. It returns `{ id, version }`; omitted status preserves the current status. Ordinary privileged comments are never automatically official.
- `GET /api/feedback/posts/:id/responses/:responseId` returns the immutable public response for direct links.
- `GET /api/feedback/posts/:id/discussion` merges comments and official responses chronologically. Optional `type` accepts the four ordinary types or `team`; omission selects All. It returns discriminated `entries` and `nextCursor`; both sources share one consistent snapshot and are bounded before merging. The older comments API still returns only comments.
- `PUT /api/feedback/posts/:id/follow` accepts `{ following: boolean }` and sets the member's subscription explicitly.
- `GET /api/feedback/notifications` is private to the session owner. It accepts `unread=true|false`, cursor, and limit; returns notifications and the owner's total `unreadCount`. `PATCH /api/feedback/notifications/:notificationId` accepts `{ read: true }` and cannot read another member's item.
- `GET /api/feedback/review` requires community-manager access. It accepts category slug, status (default `new`, or `all`), `followUp=true|false`, cursor, and limit. Results are oldest-first. Follow-up requires an ordinary comment newer than the latest response, from an author who is not currently a community manager; unanswered posts are excluded.
- `PATCH /api/feedback/posts/:id/category` requires community-manager access and `{ categoryId, version }`; only active destination categories are accepted. `GET /api/feedback/posts/:id/category-history` exposes the bounded operational audit to community managers.

`shared/review/input.ts` validates official response and category commands; `shared/subscriptions/input.ts` validates follow and read commands. All new lists default to 20 and cap HTTP page sizes at 50. Direct official links use `?response=<id>#response-<id>` and resolve independently of discussion filters.

All writes require a member session and the configured origin. Viewer-aware reads are `no-store`; public projections expose `canEdit` rather than user IDs. Input validators live in `shared/discussion/input.ts`; `shared/discussion/contribution-types.ts` owns type values, labels, and prompts. The page uses `?contribution=<type>` for its filter and a separate `comment` query parameter for a direct link. A linked contribution outside the selected filter is resolved independently and labelled accordingly. HTTP entrypoints use `server/http.ts`; post/comment editing use cases enforce ownership in their respective capability. `server/write-repository.ts` owns creation serialization and limits derived from existing rows; each use case owns its transaction explicitly.

## Cross-capability operations

- Posts expose `server/posts/workflow.ts` for post locking and workflow persistence. `updatePostWorkflow` requires the caller's transaction, post lock, and checked workflow version.
- Subscriptions expose `followPost(transaction, postId, userId)` from `server/subscriptions/following.ts` and `notifyFollowers(transaction, postId, responseId, createdAt)` from `server/subscriptions/notifications.ts`. They participate in creation/publication rather than opening their own transaction.
- Review owns publication, category-correction and whole-post moderation coordination. The HTTP boundary validates the request and requires the appropriate role before invoking review or tag operations; use cases do not recheck roles mid-write. Discussion owns the combined feed; cross-capability read projections may reference the shared schema explicitly.

These helpers are internal persistence contracts, not alternative HTTP commands. Protected read projections such as the review queue and category history likewise require authorization at their HTTP entrypoint. Keep their preconditions in the owning use case. See [multi-capability transactions](../../docs/architecture.md#operations-spanning-capabilities) for the canonical rules.

## Domain rules

[Feedback documentation](../../docs/feedback.md) is the canonical source for schema and behavior:

- [Locking, archiving and visibility](../../docs/feedback.md#locking-and-archiving).
- [Application events](../../docs/events.md).
- [Retention and public attribution](../../docs/feedback.md#contribution-retention).
- [Discussion and reactions](../../docs/feedback.md#discussion-and-reactions).
- [Editing, versions, and failed requests](../../docs/feedback.md#editing-and-failed-requests).
- [Transactions, locks, snapshots, and ordering](../../docs/feedback.md#persistence-and-concurrency).
- [Posting limits](../../docs/feedback.md#posting-limits).

For product scope and deferred work, see [requirements](../../requirements.md) and [the implementation plan](../../docs/TODO.md). For browser state and request lifetimes, see [UI conventions](../../docs/ui.md#vue-component-readability). Verification commands and suite ownership live in [Testing](../../docs/testing.md).
