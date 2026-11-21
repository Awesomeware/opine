# Feedback: schema and local use

The feedback layer provides public browsing, stable links, authenticated submission, typed contributions, discussion filters, reactions, author editing, and optional tags. The interface uses matte charcoal surfaces, gold accents, serif headings, and a centered responsive layout. Official responses and current status appear above the discussion. Members can follow outcomes and read an in-platform notification inbox; community managers have a review queue and category correction controls.

## Structured participation

Each new ordinary contribution requires an explicit choice of **Context or example**, **Different view**, **Suggestion**, or **Question**. The choice changes the composer prompt and appears as a label beside the saved contribution. Discussion filters select **All**, **Context**, **Different views**, **Suggestions**, **Questions**, or **Official responses** from one chronological discussion. Agree / Disagree remains secondary, with separate counts.

Existing comments retain their text, identity, timestamps, and versions. Migration `0003_contribution_types.sql` adds a nullable type without assigning a guessed classification. These comments display **Unspecified**, appear under All, and remain accessible through their direct links. Their authors can assign a type when editing.

The author proposal, current status, and latest official response remain visible regardless of the discussion filter. Community-maintained summaries, curated highlights, nested replies, and separate conversation threads remain deferred.

## Try it locally

With your existing Discord configuration and local PostgreSQL running:

```sh
pnpm db:migrate
pnpm dev
```

For populated discussions immediately, run `pnpm db:seed`. It adds three example posts with typed comments, official responses, reactions, and example followers. Repeated runs preserve existing content. Example people have no credentials or sessions; your own account remains separate. See [example data and reset commands](../README.md#example-data-and-starting-over) for starting over.

Visit <http://localhost:3000/feedback>. The migration creates a **General feedback** category so a fresh installation can accept submissions immediately. Sign in, select **Share feedback**, and choose **Submit feedback** when ready. Copy its link and open it in a private browser window to verify public access.

Forms keep their input in memory only. Reloading, leaving the page, cancelling an edit, or switching accounts may discard unsaved changes. There is no browser draft storage, restoration, or offline queue. Validation and network failures keep the current form text while it remains mounted. Retrying unchanged content in that form reuses its in-memory request key; after reload, fetch the saved state to see whether an uncertain submission succeeded.

## Official responses and following

To use the team workflow, grant your existing internal user ID the independent community-manager role (see [Authentication](authentication.md) for finding the ID):

```sh
pnpm auth:role grant <user-id> community-manager
```

Administrator access alone does not grant this permission. Reload the application after changing roles. The **Review queue** opens oldest-first, defaults to New, and supports category/status filters. **Needs follow-up** includes posts with ordinary comments newer than their latest official response, excluding comments whose authors currently hold the community-manager role. Posts without a response stay in initial review; this is a shared queue without assignment or per-manager read tracking.

Open a post, expand **Publish an official response**, and publish an explicit official response, optionally changing its status. A response alone does not acknowledge or change New: New means awaiting initial review. Every actual status change records its explanation, previous/new status, representative, and time. The latest response is featured; the explanation for the current status remains linked even after a later response leaves the status unchanged. Earlier responses remain in All and Official responses and have permanent links. Corrections use a new response; official records are not edited in place. Ordinary comments by managers remain ordinary contributions.

Members can follow or unfollow any post, including their own automatically followed posts. Each official response creates one inbox notification per current follower, including a combined status change; comments do not notify. The inbox supports unread filtering and marking a notification read, and links to the exact response. No email, push, or Discord delivery is included.

Community managers may correct a post's category to an active category. The separate audit records the actor, time, previous category, and replacement category; it does not mark the author's proposal text as edited.

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

## Tags

Administrators can open **Tags** in the main navigation (`/feedback/tags`) to create, rename, disable, or re-enable tags. Community-manager access alone does not grant this permission. Names are trimmed, 1–40 characters, and unique without regard to case. Renaming updates the label wherever the tag appears; concurrent management changes require reviewing the latest version before saving.

Migrations install **Gameplay**, **UI**, **Class-specific**, **Combat**, and **$$$** (money/cash shop). Existing feedback starts with no tags. Tags supplement the required category; authors select zero or more on submission and can change the selection through **Edit feedback**. Selected tags appear on list rows and the proposal. Tag filtering is deferred.

Disabled tags remain on existing posts but cannot be newly assigned. An author may keep or remove a disabled tag already attached to their post. Disabling and renaming do not mark the post as edited; changing its assignments does. There is no tag deletion action and no administrator override of author selections.

The post, tags, and initial author follow commit together. Post edits use one version and transaction for text and tags. Omitted `tagIds` preserves assignments on edit and means none on creation; explicit `[]` clears them. Legacy request fingerprints retain omission so pending requests from before tags were introduced can still be retried. Tag IDs are normalized as a set, with a 100-ID request bound. This is a safety bound, not a required selection count.

Reset restores the five initial tags. Example seeding adds tags only to newly inserted example posts and respects disabled tags; repeating it does not replenish tags removed from existing examples.

## Tables

Authentication remains in [the auth schema](../layers/auth/server/schema.ts). Feedback references the internal `auth_user.id`, never a Discord ID or email address. All feedback timestamps are `timestamptz(3)`; created timestamps default to now, and operations maintain update/edit timestamps explicitly.

| Table               | Columns                                                                                                                                                                                                                   | Constraints                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback_category` | UUID `id`; text `slug`, `name`; integer `sort_order`; boolean `is_active`; `created_at`, `updated_at`                                                                                                                     | Primary key `id`; unique slug; valid slug/name checks; active by default                                                                 |
| `feedback_post`     | UUID `id`; text `author_id`; UUID `category_id`; text `title`, `description`; nullable text `desired_improvement`; enum `status`; integer `version`, `workflow_version`; nullable `edited_at`; `created_at`, `updated_at` | Primary key `id`; required author/category foreign keys with `ON DELETE RESTRICT`; text length/nonblank checks; status defaults to `new` |
| `feedback_follow`   | UUID `post_id`; text `user_id`; `created_at`                                                                                                                                                                              | Composite primary key `(post_id, user_id)`; foreign keys cascade on post/user deletion                                                   |

Additional participation tables:

| Table                    | Columns                                                                                                                     | Constraints                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback_comment`       | UUID `id`, `post_id`; text `author_id`, `body`; nullable enum `type`; integer `version`; nullable `edited_at`; `created_at` | Author/post references restrict deletion; body required, at most 10,000 characters; positive version; type required on new submissions |
| `feedback_reaction`      | UUID `post_id`; text `user_id`; enum `kind` (`agree`, `disagree`); `created_at`, `updated_at`                               | Composite primary key `(post_id, user_id)`; removable on post/user deletion                                                            |
| `feedback_write_receipt` | text `actor_id`, `operation`, `request_hash`; UUID `request_id`; JSON `result`; `created_at`                                | Composite primary key `(actor_id, request_id)`; removed on user deletion; no content text in results                                   |

Official workflow tables:

| Table                        | Columns and constraints                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `feedback_official_response` | UUID `id`, `post_id`; text `author_id`, `body`; nullable `previous_status`, `status`; `created_at`. Author/post deletion is restricted. Status fields are both NULL or contain an actual change. |
| `feedback_notification`      | UUID `id`, `response_id`; text `user_id`; nullable `read_at`; `created_at`. Unique `(user_id, response_id)`; recipient deletion cascades.                                                        |
| `feedback_category_change`   | UUID `id`, `post_id`, `previous_category_id`, `category_id`; text `actor_id`; `created_at`. Referenced posts, categories, and actors use restrictive deletion.                                   |

Creating feedback inserts the post and the author's follow in one transaction. Publishing an official response, changing status, creating follower notifications, and saving its receipt also commit or roll back together. Follow changes and publication serialize on the post row so recipient membership has one defined ordering.

Post statuses are `new`, `reviewing`, `planned`, `delivered`, `not_planned`, and `answered`. The submission endpoint always chooses `new`; changing status requires an explicit community-manager response. Titles are limited to 200 characters, descriptions to 10,000, and suggested improvements to 5,000. Empty optional improvement text becomes NULL. Content is rendered as plain text, without executing markup.

Indexes support newest-first browsing, category/status filtering, author lookup, and user follows. Pagination uses creation time plus ID to handle equal timestamps deterministically. Search currently uses literal case-insensitive substring matching across title and description; it has no dedicated full-text search index. Reassess search indexing with actual data volume rather than changing search semantics accidentally.

The tag tables extend this schema:

| Table               | Fields and constraints                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feedback_tag`      | UUID `id`; unique case-insensitive text `name`; boolean `is_active`; positive integer `version`.                                                    |
| `feedback_post_tag` | Composite primary key `(post_id, tag_id)`; post deletion cascades assignments; referenced tag deletion is restricted. An index supports tag lookup. |

## Contribution retention

Deleting a user must not delete their contributions. Author foreign keys currently block physical deletion when posts, comments, official responses, or category audit records exist. Posts with comments also cannot be physically deleted. Removable reactions, follows, and private write receipts are not retained if their account is eventually deleted. A future explicit anonymization/deletion workflow must decide how to retain attribution and handle personal data before the public pilot. There is no self-service deletion endpoint.

Public responses expose the author's current display name. They omit email, session data, provider identities, and privileged-role assignments. Administrator status does not make a contribution official.

## Discussion and reactions

Contributions are flat, public, chronological, and loaded in batches of 20 (maximum 50). Types are `context`, `different_view`, `suggestion`, and `question`. The server applies type filters before pagination; changing the filter starts a new page sequence. The page stores the selected filter in `?contribution=<type>` (`team` for official responses), so reload and browser navigation preserve it. Comment links use `/feedback/<post-id>?comment=<comment-id>#comment-<comment-id>`; the independent `comment` parameter resolves a linked comment even outside the loaded page or selected type filter. That entry is shown separately with an explanation, without changing the filter. Plain text is escaped; HTTP/HTTPS URLs become links without permitting active markup.

Each signed-in member may select Agree or Disagree, change their choice, or select it again to remove it. Authors may react to their own posts. Counts remain separate, with no score, ranking, visibility, or reputation effect. Neither choice implies following a post. An optional “Add a comment” action focuses the normal comment form; reactions and comments remain independent.

## Editing and safe retries

Authors may edit their own post text, tag selections, and ordinary comments. Post category and status are excluded. A text, tag-selection, or contribution-type change increments `version` and sets `edited_at`; an unchanged save does neither. Authors may change their contribution type. Omitting type from a comment edit preserves the existing classification, including NULL on legacy comments; explicitly clearing it is rejected. There are no original-content copies or revision tables. Existing reactions and comments remain attached after edits.

Edit requests include the loaded version. A mismatch returns 409 and preserves the text in the open form. The interface requires loading and reviewing the latest saved content before retrying an edit against its new version. Official-response and category forms also retain their mounted workflow version until a confirmed save or explicit review; changing the workflow in another form can therefore require review.

Every feedback write requires a UUID `Idempotency-Key` header. The browser keeps the key in memory for the mounted operation. Successful changes and receipts commit atomically. Replaying the same actor/key and normalized operation/input returns the original result before checking quotas or edit versions; different input with the same key returns 409. Current authorization is still enforced. Receipts contain only a fingerprint and IDs/version result, not old content, and currently have no expiry. The browser uses a new key when the intended input changes. Reactions and following refresh the actual server state after uncertain replies.

Every comment create request must include a valid contribution type, including retries. The body-only pre-upgrade replay path is retired; historical comments and receipts remain stored. Type is part of the fingerprint for new submissions and explicit type edits. Omitted type on edit and omitted tag IDs retain their existing meanings and fingerprints.

Official updates and category corrections use `workflow_version`, independent of author text `version`. Conflicting changes return 409 before overwriting the current workflow. Current community-manager authorization is checked transactionally before receipt replay, so a revoked role cannot replay an official write. Replaying an earlier follow receipt does not undo a later unfollow.

## Persistence and concurrency

Use cases coordinate capability-owned persistence functions by passing one transaction explicitly. Post creation includes its author follow; official publication includes the post workflow update and follower notifications. See [capability ownership and transaction boundaries](architecture.md#operations-spanning-capabilities) for code locations.

Creation inserts the post, tags, and author follow atomically. Category availability is checked under a shared row lock; selected tag rows are locked while validating assignments. An actor row lock serializes writes, including successful-post limits. Mutations and receipts commit together, with authorization before replay and replay before quota/version checks. Receipt fingerprints include operation and target; results hold only resource IDs and versions. Keep receipts until an explicit retention decision.

Official publication locks the post and atomically writes the immutable response, optional status delta, follower notifications, and receipt. An unchanged status stores no delta. Follow changes take the same post lock; replay returns the recorded result without applying it again. Category correction shares the workflow version and writes its own audit. Author edits use an independent version. Current community-manager authority is checked inside the actor transaction; administrator alone is insufficient. Actor locks use `FOR NO KEY UPDATE`, allowing notification foreign keys to reference other active members while still conflicting with role-management locks.

Outcome reads use one repeatable-read snapshot for status/version, featured response, and status explanation. Discussion reads use one snapshot for comments and official responses so a concurrent insert cannot be skipped between source reads. Each source is bounded before merging. Reaction totals and the viewer's selection come from one query. Inbox entries and the unread count share one repeatable-read snapshot. Public post reads also keep text and tags coherent. Responses explicitly select public fields.

Post lists sort by `(created_at DESC, id DESC)`; comments and discussion sort ascending. Filters apply before pagination, and each list reads an extra row to determine whether another page exists. Millisecond timestamp precision matches JavaScript cursor serialization. Publication timestamps are assigned after locking the post, strictly later than prior responses and comments. Comments waiting for publication receive a timestamp after that response, preserving chronology and follow-up eligibility. Notifications inherit the publication timestamp; ordinary comments never notify.

## Posting limits

`FEEDBACK_POST_MAX` defaults to 5 successful submissions per member within `FEEDBACK_POST_WINDOW_SECONDS` (default 60). Both accept integers from 1 to 86400. Counts are derived from persisted posts, so the limit survives application restarts. Concurrent submissions by one author are serialized. Failed validation does not create a post or consume this successful-submission allowance.

Participation uses `FEEDBACK_PARTICIPATION_WINDOW_SECONDS` (default 60): `FEEDBACK_COMMENT_MAX=10`, `FEEDBACK_REACTION_MAX=30`, `FEEDBACK_EDIT_MAX=20`, `FEEDBACK_RESPONSE_MAX=20`, and `FEEDBACK_FOLLOW_MAX=30`. Edit limits apply separately to post edits and comment edits. These limits count successful new requests, including unchanged saves; replaying a receipt does not consume another allowance. All settings accept integers from 1 to 86400.

Limits return 429 with `Retry-After`. Authentication and origin checks apply before submission. Request validation returns 400 with field errors; unauthenticated writes return 401 and invalid-origin writes 403.

## Verification

See [Testing](testing.md) for commands, coverage, migration checks, and the dedicated database/application restart scenario. Database tests always use disposable suite databases.
