# Feedback: schema and local use

The feedback layer provides public browsing, stable links, authenticated submission, comments, reactions, and author editing. The interface follows the simplified visual reference with dark navy surfaces, gold accents, serif headings, and a centered responsive layout. Typed contributions and discussion filters are agreed next work in checklist #4a; official responses, follow controls, and notifications remain in #5.

## Agreed next scope

The current implementation still has untyped flat comments. The [requirements](../requirements.md) and [checklist](TODO.md) now include these additions to v1:

- An explicit choice of **Context or example**, **Different view**, **Suggestion**, or **Question** for each new ordinary contribution, with an appropriate composer prompt and a visible type label.
- Discussion filters for **All**, **Context**, **Different views**, **Suggestions**, **Questions**, and **Team responses**. These select from one flat discussion, with chronological pagination across all matching entries. Team responses will arrive with the official-response workflow in #5.
- A page centered on the author's proposal, prominent current status and latest official response, then community contributions. The team position stays visible while filtering; Agree / Disagree remains a secondary action with separate counts.

Community-maintained summaries and curated highlights remain deferred, as do nested replies and separate conversation threads. The existing schema and endpoints below describe implemented behavior; this scope adjustment does not yet add contribution types or official responses to them.

## Try it locally

With your existing Discord configuration and local PostgreSQL running:

```sh
pnpm db:migrate
pnpm dev
```

Visit <http://localhost:3000/feedback>. The migration creates a **General feedback** category so a fresh installation can accept submissions immediately. Sign in, select **Share feedback**, and choose **Submit feedback** when ready. Copy its link and open it in a private browser window to verify public access.

The submission form keeps a draft in session storage, separately for each signed-in account. It survives a page reload in the same browser tab, but is not synchronized to other devices and is not a server backup. Successful publication clears the saved draft. Validation errors preserve the entered fields. If submission cannot be confirmed after a network failure, retrying the same content uses its saved request key. Comments and edits also keep account-specific drafts in this tab.

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

Authentication remains in [the auth schema](../layers/auth/server/schema.ts). Feedback references the internal `auth_user.id`, never a Discord ID or email address. All feedback timestamps are `timestamptz(3)`; created timestamps default to now, and operations maintain update/edit timestamps explicitly.

| Table               | Columns                                                                                                                                                                                               | Constraints                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback_category` | UUID `id`; text `slug`, `name`; integer `sort_order`; boolean `is_active`; `created_at`, `updated_at`                                                                                                 | Primary key `id`; unique slug; valid slug/name checks; active by default                                                                 |
| `feedback_post`     | UUID `id`; text `author_id`; UUID `category_id`; text `title`, `description`; nullable text `desired_improvement`; enum `status`; integer `version`; nullable `edited_at`; `created_at`, `updated_at` | Primary key `id`; required author/category foreign keys with `ON DELETE RESTRICT`; text length/nonblank checks; status defaults to `new` |
| `feedback_follow`   | UUID `post_id`; text `user_id`; `created_at`                                                                                                                                                          | Composite primary key `(post_id, user_id)`; foreign keys cascade on post/user deletion                                                   |

Additional participation tables:

| Table                    | Columns                                                                                               | Constraints                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `feedback_comment`       | UUID `id`, `post_id`; text `author_id`, `body`; integer `version`; nullable `edited_at`; `created_at` | Author/post references restrict deletion; body required, at most 10,000 characters; positive version |
| `feedback_reaction`      | UUID `post_id`; text `user_id`; enum `kind` (`agree`, `disagree`); `created_at`, `updated_at`         | Composite primary key `(post_id, user_id)`; removable on post/user deletion                          |
| `feedback_write_receipt` | text `actor_id`, `operation`, `request_hash`; UUID `request_id`; JSON `result`; `created_at`          | Composite primary key `(actor_id, request_id)`; removed on user deletion; no content text in results |

Creating feedback inserts the post and the author's follow in one transaction. The follow controls and notifications are deferred to #5; the initial subscription is already durable.

Post statuses are `new`, `reviewing`, `planned`, `delivered`, `not_planned`, and `answered`. The submission endpoint always chooses `new`; changing status requires the later official-response workflow. Titles are limited to 200 characters, descriptions to 10,000, and suggested improvements to 5,000. Empty optional improvement text becomes NULL. Content is rendered as plain text, without executing markup.

Indexes support newest-first browsing, category/status filtering, author lookup, and user follows. Pagination uses creation time plus ID to handle equal timestamps deterministically. Search currently uses literal case-insensitive substring matching across title and description; it has no dedicated full-text search index. Reassess search indexing with actual data volume rather than changing search semantics accidentally.

## Contribution retention

Deleting a user must not delete their contributions. Author foreign keys currently block physical deletion when posts or comments exist. Posts with comments also cannot be physically deleted. Removable reactions, follows, and private write receipts are not retained if their account is eventually deleted. A future explicit anonymization/deletion workflow must decide how to retain attribution and handle personal data before the public pilot. There is no self-service deletion endpoint.

Public responses expose the author's current display name. They omit email, session data, provider identities, and privileged-role assignments. Administrator status does not make a contribution official.

## Discussion and reactions

Comments are flat, public, chronological, and loaded in batches of 20 (maximum 50). Comment links use `/feedback/<post-id>?comment=<comment-id>#comment-<comment-id>`; a linked comment outside the loaded page is fetched directly and shown separately. Plain text is escaped; HTTP/HTTPS URLs become links without permitting active markup.

Each signed-in member may select Agree or Disagree, change their choice, or select it again to remove it. Authors may react to their own posts. Counts remain separate, with no score, ranking, visibility, or reputation effect. Neither choice implies following a post. An optional “Add a comment” action focuses the normal comment form; reactions and comments remain independent.

## Editing and safe retries

Authors may edit their own post text and ordinary comments. Post category and status are excluded. An actual change replaces the current text, increments `version`, and sets `edited_at`; unchanged text does not mark an edit. There are no original-content copies or revision tables. Existing reactions and comments remain attached after edits.

Edit requests include the loaded version. A mismatch returns 409 and preserves the draft. The interface requires loading and reviewing the latest saved content before retrying an edit against its new version.

Every feedback write requires a UUID `Idempotency-Key` header. The browser saves the key with its pending request before sending. Successful changes and receipts commit atomically. Replaying the same actor/key and normalized operation/input returns the original result before checking quotas or edit versions; different input with the same key returns 409. Current authorization is still enforced. Receipts contain only a fingerprint and IDs/version result, not old content, and currently have no expiry. The browser uses a new key when the intended input changes. Pending reactions use an explicit retry button so an uncertain add does not turn into a removal.

## Posting limits

`FEEDBACK_POST_MAX` defaults to 5 successful submissions per member within `FEEDBACK_POST_WINDOW_SECONDS` (default 60). Both accept integers from 1 to 86400. Counts are derived from persisted posts, so the limit survives application restarts. Concurrent submissions by one author are serialized. Failed validation does not create a post or consume this successful-submission allowance.

Participation uses `FEEDBACK_PARTICIPATION_WINDOW_SECONDS` (default 60): `FEEDBACK_COMMENT_MAX=10`, `FEEDBACK_REACTION_MAX=30`, and `FEEDBACK_EDIT_MAX=20`. Edit limits apply separately to post edits and comment edits. These limits count successful new requests, including unchanged saves; replaying a receipt does not consume another allowance. All settings accept integers from 1 to 86400.

Limits return 429 with `Retry-After`. Authentication and origin checks apply before submission. Request validation returns 400 with field errors; unauthenticated writes return 401 and invalid-origin writes 403.

## Verification

```sh
pnpm test
pnpm test:integration
pnpm test:e2e
```

The feedback integration suite verifies atomic creation and rollback, author privacy, deletion restrictions, category configuration, search, pagination, concurrent limits, reaction switching/removal, retry deduplication, and edit conflicts. The browser suite covers publication, draft preservation, public sharing, filters, pagination, validation, mobile layout, comments, reactions, conflict review, and retries after a lost response.

The browser runner then stops the first app process, restarts the same PostgreSQL container, and starts a fresh app process at the same origin. A second phase opens the exact saved public link and verifies the original session and follow, edited content and versions, reactions, comment links, and write receipts. Both phases belong to one logical suite and share one database container; temporary session fixtures are deleted after the suite.
