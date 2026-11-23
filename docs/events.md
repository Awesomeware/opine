# Application event log

`event_log` is an internal, append-only record of successful business mutations. The owning use case appends an event using its existing transaction, so the mutation and event either commit together or both roll back. Unchanged operations and rejected requests do not append events. Reads and marking notifications read are not business events.

The log is not a content revision history, event bus, retry mechanism, or source for rebuilding application state. It does not drive follower notifications. There is no event-history UI or public endpoint in this release.

## Schema and actors

| Column       | Definition                                                           |
| ------------ | -------------------------------------------------------------------- |
| `id`         | UUID primary key                                                     |
| `created_at` | Required timestamp with time zone                                    |
| `event_type` | Required text event name                                             |
| `actor_id`   | Nullable text reference to `auth_user.id`, with `ON DELETE RESTRICT` |
| `details`    | Required JSONB event metadata                                        |

Event-specific identifiers belong in `details`; there are no `subject_type`, `subject_id`, or `post_id` columns. Indexes on `(created_at, id)` and `(event_type, created_at, id)` support chronological inspection. Add JSON indexes only when a concrete query needs them.

A non-NULL actor is the authenticated internal user responsible for the action. NULL explicitly means a system action, including trusted operator commands without an authenticated application user. Do not create a reserved system account or use `ON DELETE SET NULL`: deleting a human actor must not relabel their history as system activity. The operator account-retention process must preserve this distinction.

## Event vocabulary

| Events                                          | Metadata purpose                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `post.created`, `post.edited`                   | Post identity, version and changed field names where relevant         |
| `post.locked`, `post.unlocked`, `post.archived` | Post identity                                                         |
| `comment.created`, `comment.edited`             | Post/comment identity, version and changed field names where relevant |
| `official_response.published`                   | Post and response identity                                            |
| `reaction.changed`                              | Post identity and previous/new reaction, including removal            |
| `post.followed`, `post.unfollowed`              | Post identity                                                         |
| `tag.created`, `tag.updated`                    | Tag identity, version and changed field names where relevant          |
| `role.granted`, `role.revoked`                  | Target user identity and role                                         |

Details are typed per event in [the server append operation](../server/events/repository.ts), constructed by trusted operations rather than accepted as arbitrary client payloads. Store IDs, versions, changed field names and small facts needed to explain the action. Do not store post/comment bodies, previous content, secrets, or complete requests. Historical category-change events may remain in existing installations, but no new category events are emitted.

Existing domain records are not retroactively reconstructed into events. Direct test fixtures and example-data seeding are not application user actions and do not create business events. Archiving preserves existing event records alongside the hidden content; application queries must not expose the log as a route around archive visibility. See [feedback moderation](feedback.md#locking-and-archiving), [transaction boundaries](architecture.md#operations-spanning-capabilities), and [retention](feedback.md#contribution-retention).
