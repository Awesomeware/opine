# Feedback: schema and local use

TODO #3 adds a public feedback feed, stable detail links, and authenticated submission in `layers/feedback/`. The interface follows the simplified visual reference with dark navy surfaces, gold accents, serif headings, and a centered responsive layout. Comments, reactions, and official responses are later checklist steps.

## Try it locally

With your existing Discord configuration and local PostgreSQL running:

```sh
pnpm db:migrate
pnpm dev
```

Visit <http://localhost:3000/feedback>. The migration creates a **General feedback** category so a fresh installation can accept submissions immediately. Sign in, select **Share feedback**, and choose **Submit feedback** when ready. Copy its link and open it in a private browser window to verify public access.

The submission form keeps a draft in session storage, separately for each signed-in account. It survives a page reload in the same browser tab, but is not synchronized to other devices and is not a server backup. Successful publication clears the saved draft. Validation errors preserve the entered fields. If publication cannot be confirmed after a network failure, check the feed before retrying: idempotent retries are scheduled for TODO #4.

## Category configuration

An operator can add categories or change their names and ordering through the CLI, which reads `.env` and honors an exported `DATABASE_URL`:

```sh
pnpm feedback:category upsert combat "Combat" 10
pnpm feedback:category upsert grouping-travel "Grouping & travel" 20
pnpm feedback:category disable general
pnpm feedback:category enable general
```

Slugs use lowercase letters, digits, and separating hyphens, up to 80 characters. Names contain 1–80 characters. Sort order is an integer, defaulting to 0; lower values appear first. Repeating an upsert preserves the category's ID and existing posts. Updating an inactive category does not silently enable it. Renames appear on all associated posts.

Inactive categories remain visible on old posts and in browsing filters. They cannot receive new submissions. Physical deletion is blocked while posts reference a category. These commands require database operator access; a category administration screen is not included yet.

## Tables

Authentication remains in [the auth schema](../layers/auth/server/schema.ts). Feedback references the internal `auth_user.id`, never a Discord ID or email address. All feedback timestamps are `timestamptz(3)`; created timestamps default to now, and operations maintain updated timestamps explicitly.

| Table               | Columns                                                                                                                                                      | Constraints                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback_category` | UUID `id`; text `slug`, `name`; integer `sort_order`; boolean `is_active`; `created_at`, `updated_at`                                                        | Primary key `id`; unique slug; valid slug/name checks; active by default                                                                 |
| `feedback_post`     | UUID `id`; text `author_id`; UUID `category_id`; text `title`, `description`; nullable text `desired_improvement`; enum `status`; `created_at`, `updated_at` | Primary key `id`; required author/category foreign keys with `ON DELETE RESTRICT`; text length/nonblank checks; status defaults to `new` |
| `feedback_follow`   | UUID `post_id`; text `user_id`; `created_at`                                                                                                                 | Composite primary key `(post_id, user_id)`; foreign keys cascade on post/user deletion                                                   |

Creating feedback inserts the post and the author's follow in one transaction. The follow controls and notifications are deferred to #5; the initial subscription is already durable.

Post statuses are `new`, `reviewing`, `planned`, `delivered`, `not_planned`, and `answered`. The submission endpoint always chooses `new`; changing status requires the later official-response workflow. Titles are limited to 200 characters, descriptions to 10,000, and suggested improvements to 5,000. Empty optional improvement text becomes NULL. Content is rendered as plain text, without executing markup.

Indexes support newest-first browsing, category/status filtering, author lookup, and user follows. Pagination uses creation time plus ID to handle equal timestamps deterministically. Search currently uses literal case-insensitive substring matching across title and description; it has no dedicated full-text search index. Reassess search indexing with actual data volume rather than changing search semantics accidentally.

## Contribution retention

Deleting a user must not delete their contributions. The author foreign key currently blocks physical deletion when posts exist. A future explicit anonymization/deletion workflow must decide how to retain attribution and handle personal data before the public pilot. There is no self-service deletion endpoint.

Public responses expose the author's current display name. They omit email, session data, provider identities, and privileged-role assignments. Administrator status does not make a contribution official.

## Posting limits

`FEEDBACK_POST_MAX` defaults to 5 successful submissions per member within `FEEDBACK_POST_WINDOW_SECONDS` (default 60). Both accept integers from 1 to 86400. Counts are derived from persisted posts, so the limit survives application restarts. Concurrent submissions by one author are serialized. Failed validation does not create a post or consume this successful-submission allowance.

Limits return 429 with `Retry-After`. Authentication and origin checks apply before submission. Request validation returns 400 with field errors; unauthenticated writes return 401 and invalid-origin writes 403.

## Verification

```sh
pnpm test
pnpm test:integration
pnpm test:e2e
```

The feedback integration suite verifies atomic creation and rollback, author privacy, deletion restrictions, category configuration, search, pagination, and concurrent limits. The browser suite covers publication, draft preservation, public sharing, filters, pagination, validation, and mobile layout.

The browser runner then stops the first app process, restarts the same PostgreSQL container, and starts a fresh app process at the same origin. A second phase opens the exact saved public link and verifies the original session and follow. Both phases belong to one logical suite and share one database container; temporary session fixtures are deleted after the suite.
