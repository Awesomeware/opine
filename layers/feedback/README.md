# Feedback feature

This layer owns categories, posts, and follows. Its schema lives in `server/schema.ts`, aggregated by the root database schema. It consumes the shared database pool and auth's public identity/session entrypoints. The approved schema and local operations are described in [Feedback](../../docs/feedback.md).

## Public entrypoints

- `GET /api/feedback/categories` lists categories in configured order, including inactive categories needed for browsing older feedback.
- `GET /api/feedback/posts` lists public posts newest first. It accepts `q`, category slug, status, `limit` (1–50, default 20), and an opaque cursor. Search is a case-insensitive literal substring of the title or description, including literal `%` and `_` characters. Results contain an excerpt and public author name, without private account fields.
- `GET /api/feedback/posts/:id` returns the public post, its category, and the author's current display name. Invalid or missing IDs return 404.
- `POST /api/feedback/posts` requires a member session and the configured same-origin `Origin` header. It accepts only title, description, optional desired improvement, and category ID. The server supplies author, status, identity, and timestamps. Success returns 201 with `{ id }`.

The `server/posts.ts` functions are internal use cases. In particular, `createPost` expects an already-authenticated internal user ID and validated input; it must not be exposed directly to arbitrary client-supplied authors. Future features must preserve this boundary.

`shared/post-input.ts` owns browser-safe validation and limits. `shared/contracts.ts` describes the serialized public responses; database types remain derived from Drizzle. Server-only `list-input.ts` validates filters and decodes the pagination cursor before any SQL query.

## Persistence and concurrency

Creation inserts the post and its author follow in one transaction. Category selection takes a shared row lock so disabling a category cannot race past creation's availability check. Submissions by one author lock that user's row, making the successful-post rate limit effective across concurrent requests and application instances.

Author and category references use restrictive deletion. Removing authentication credentials or a session does not remove posts. A user record with contributions cannot be physically deleted until an explicit retention/anonymization workflow is implemented. Disabling a category preserves its existing posts. Removing a post cascades only its follows; no public delete operation exists in this step.

Pagination orders by `(created_at DESC, id DESC)` and fetches one extra row to determine whether another page exists. Feedback timestamps use millisecond precision to match JavaScript dates exactly; cursor serialization must not discard stored timestamp precision. Reset the cursor when filters change. Public list/detail responses explicitly select public fields rather than serializing user rows.

## Deferred behavior

The author follow is persisted now; follow/unfollow controls and notifications arrive in TODO #5. Comments, confirmations, editing/revisions, and idempotent retry handling arrive in #4. Status changes and official responses arrive in #5. Moderation and account anonymization must be implemented before the public pilot. Never infer moderation or official-response authority from the administrator role.

Until retry handling is implemented, disable duplicate clicks while publishing. An ambiguous network failure must advise the author to check the feedback list before retrying; it must not automatically repeat a write.
