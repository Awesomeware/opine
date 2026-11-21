# Opine — first-version requirements

## Product goal

Give game feedback a durable home where players can contribute context, different views, suggestions, and questions; community managers can acknowledge and respond; and participants can follow the outcome.

The first version must work without volunteer curation. Its core loop is: submit feedback → add structured contributions → receive an official response → follow the outcome. The proposal, community contributions, and team position must remain easy to distinguish. Agree / Disagree reactions are a secondary signal.

This is the first-release boundary, replacing the broader draft. `V1-` identifiers belong to this reduced scope. Deferred features are not prerequisites for release.

Implementation status and the agreed sequence live in [the implementation checklist](docs/TODO.md). Unfinished release requirements remain in scope; the deferred list below is not a backlog that must be completed before launch.

## Scope and operating model

- V1-S01: Support feedback about player experiences and proposed improvements. A player shall not need to propose a solution to describe a concern.
- V1-S02: Bug reporting and diagnostic fields, including game version, platform, and reproduction steps, are outside scope.
- V1-S03: Preserve substantive criticism and differing experiences. Agree / Disagree reactions indicate participating accounts’ views, not a representative survey or a promise of priority.
- V1-S04: Serve one community per installation. Independent communities can operate their own installations and data.
- V1-S05: Community managers handle official responses and basic moderation in v1. Administrators manage access and installation settings. There is no separate curator or volunteer moderator role in this version.
- V1-S06: Fit alongside the community's existing Discord through Discord sign-in and ordinary links. Discord bots, automatic cross-posting, and migration of existing conversations are not required.

## Access and roles

- V1-F01: Visitors shall be able to browse, search, and read public feedback, comments, and official responses without signing in.
- V1-F02: Members shall sign in before posting, commenting, reacting to feedback, or following feedback. Discord shall be the only enabled sign-in method in v1. Public contributions shall identify members by a display name.
- V1-F03: Support member, community manager, and administrator roles. An account may hold multiple roles; privileged accounts retain ordinary member capabilities.
- V1-F04: Only community managers shall publish official responses, change feedback statuses, or lock, unlock and archive feedback posts. Administrative access alone shall not confer these powers or make contributions official.

## Feedback and discussion

- V1-F05: Each feedback post shall contain a title, feedback description, optional suggested improvement, one category, zero or more author-selected tags, author, creation time, and current status. New posts shall start as New.
- V1-F06: Each member shall be able to add, change, or remove one Agree or Disagree reaction per post, including their own posts. Display separate counts for the two reactions, never a combined score. Reactions shall not affect ranking, visibility, account reputation, or moderation. There shall be no comment reactions. Both reactions may invite an optional, independent typed contribution. A reaction does not determine the contribution type, and contributing does not require reacting.
- V1-F07: Members shall explicitly choose one contribution type before submitting an ordinary comment: Context or example, Different view, Suggestion, or Question. The selected type shall guide the composer prompt and be displayed on the contribution. Types describe the purpose of the contribution, not its sentiment or official status. Discussion remains flat, without nested replies. Plain text with links is sufficient; attachments and a rich text editor are outside v1.
- V1-F08: A post's discussion shall offer All, Context, Different views, Suggestions, Questions, and Official responses filters. All includes every permitted ordinary contribution and official response. Type filters select ordinary contributions by their declared type; Official responses selects only explicitly official responses. Each view shall preserve chronological order and load bounded pages across the full matching discussion, not just filter already-loaded items. Display author, publication time, and contribution type or official badge. These are views of one discussion, not separate conversation threads. Comment volume shall not affect a post's placement in feedback lists.
- V1-F09: Authors shall be able to edit their own posts and ordinary comments. Edits shall display an edited indicator and retain only current content, the last edit time, and a version number for conflict detection. Original text and intermediate revisions shall not be retained. Unchanged submissions shall not count as edits. Authors may edit post text and tags, but not its category or status. Existing comments and reactions remain attached after edits.
- V1-F10: Posts, comments, and official responses shall have stable direct links suitable for sharing in Discord.
- V1-F11: Feedback pages shall display the current feedback, the latest official response when present, and the full discussion in that order. The team response shall be visually distinct from both the proposal and ordinary contributions, with the current status prominent. If no official response exists, say so; New means awaiting initial review, not acknowledged. Discussion filters shall not hide the featured response or current status. Summaries and curated highlights are outside v1.

### Contribution types

Each new ordinary contribution requires an explicit choice; there is no preselected catch-all type. Members choose the main purpose when a contribution covers more than one point. The type is independent of post category, status, and Agree / Disagree reactions. Official responses use a separate CM action, not a fifth selectable member type.

| Type               | Purpose                                                   | Composer guidance                                                   |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Context or example | Add relevant details, observations, or concrete examples. | What context or example would help others understand this feedback? |
| Different view     | Offer a contrasting viewpoint, concern, or tradeoff.      | What do you see differently, and why?                               |
| Suggestion         | Propose a change, alternative, or refinement.             | What would you suggest, and how would it help?                      |
| Question           | Ask for clarification or information.                     | What would you like clarified or answered?                          |

## Official responses and outcomes

- V1-F12: Publishing an official response shall be an explicit community-manager action. Ordinary comments from privileged accounts shall not automatically carry an official badge.
- V1-F13: Official responses shall display a distinct team badge and publication time. The latest response shall appear automatically above the discussion; earlier responses shall remain accessible in All and Official responses. Corrections shall use a new official response, preserving the earlier record unless moderation restricts it.
- V1-F14: Feedback shall use the following statuses:

| Status      | Meaning                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| New         | Awaiting initial review.                                                                 |
| Reviewing   | The team has acknowledged the feedback and is evaluating it, without promising a change. |
| Planned     | The team explicitly intends to make a change.                                            |
| Delivered   | The planned change is available to players.                                              |
| Not planned | The team has decided not to pursue a change at present, with an explanation.             |
| Answered    | The feedback is resolved through an explanation; no implementation decision is needed.   |

- V1-F15: A community manager shall be able to publish an official response with an optional status change. Every status change shall accompany an official response explaining it and retain the previous status, new status, representative, and time. Readers shall be able to find the explanation for the current status even if a later official response does not change that status. Publishing a response alone shall not automatically change the status.
- V1-F16: Community managers shall be able to revisit feedback and change any status. Statuses shall not close discussion or prevent additional reactions.

## Discovery and the CM work queue

- V1-F17: Public feedback lists shall show newest posts first and support text search of titles and feedback descriptions, plus category and status filters. Automatic duplicate suggestions, tag-based filtering, and popularity rankings are outside this iteration.
- V1-F18: Community managers shall have a work queue with category and status filters and oldest-first ordering, defaulting to New posts. A follow-up filter shall show posts with ordinary member comments newer than the latest official response, excluding comments from community managers. Posts without an official response belong in the initial-review queue rather than this follow-up filter. This is a shared queue, with no assignment or per-manager read tracking.
- V1-F19: Community managers shall be able to correct a post's category, recording the actor, time, and previous category in a category-change audit record. This operational audit is separate from author text edits.

## Following and notifications

- V1-F20: Members shall be able to follow and unfollow posts. Authors shall automatically follow their own new posts and may unfollow them.
- V1-F21: Followers shall receive in-platform notifications for new official responses, including any accompanying status change. A combined response and status change shall produce one notification per follower, linked to that response.
- V1-F22: Members shall be able to see unread notifications and mark them as read. Ordinary comments shall not trigger notifications in v1; email, push, and Discord delivery are deferred.

## Basic moderation and administration

- V1-F23: The installation shall publish community rules distinguishing criticism and disagreement from prohibited conduct. Negative sentiment alone shall not justify moderation.
- V1-F24: Community managers shall be able to lock and unlock whole feedback posts. A locked post remains readable and displays a Locked indicator. While locked, reject post/comment edits, new comments, reaction changes, official response/status publication and category corrections, including attempts by privileged users. Following/unfollowing and reading notifications remain available. A CM may unlock the post to resume participation or archive it.
- V1-F25: Community managers shall be able to archive a whole feedback post by setting `archived_at`. Preserve its stored content and related records, but exclude the post and all of its related content from application reads and writes, including public and CM views. There is no archive browser or unarchive UI in this release.
- V1-F26: Archived posts shall be absent from lists, search, CM queues, direct links, discussions, official-response/outcome/reaction reads, notifications and unread counts. Direct links shall return the normal unavailable/not-found result, without exposing archived titles or text. Archived posts shall not generate follower notifications; existing notification rows remain stored but are excluded from visible inboxes and counts. Lock/unlock/archive actions shall not generate follower alerts.
- V1-F27: Initial moderation shall operate on whole posts only. Reports, private report queues, individual comment/official-response hiding, account suspension, moderation reasons/action-history UI, and appeals are deferred. An internal application event log records moderation actions alongside other business mutations; it does not provide a moderation review workflow.
- V1-F28: Administrators shall have a documented way to grant and revoke community-manager and administrator roles. Installation configuration shall provide the public name, categories, rules and community link. A full settings or branding editor is not required; moderation-review contact is deferred with appeals.

- V1-F29: Administrators shall define the available post tags, initially Gameplay, UI, Class-specific, Combat, and $$$ (money/cash shop). Authors may select zero or more tags when creating or editing their own posts. Tags supplement the required category and appear on public list and detail views. Administrators may create, rename, disable, and re-enable tags; disabling prevents new selections while preserving existing assignments. Authors may retain or remove disabled tags already assigned to their post. Tag-only edits use the same edit marker and conflict version as text edits. Tag management does not grant permission to edit another author’s post.

## Presentation and accessibility

Use the approved [feedback design direction](docs/design/feedback-direction.png), with the implementation rules in [Visual direction](docs/design/README.md). The interface uses matte charcoal surfaces, warm ivory text, restrained gold actions, compact feedback rows, quiet secondary controls, and a distinct teal official-response treatment. Reserve serif type for the identity and major titles; use readable sans-serif type for discussion, metadata, and controls. On desktop, a supporting status/follow column sits alongside the proposal. Reading order remains proposal, status/latest official response, then typed community contributions. Use underline-style discussion filters and a plain-text composer with an explicit contribution-type choice and the corresponding prompt.

The approved image replaces the earlier simplified visual target. The original [example.png](example.png) remains background context for the interaction model, not a feature checklist. Image labels and fixtures are illustrative: use the existing Delivered status, actual authors and dates, and Comment link permalinks rather than introducing an Implemented status or nested Reply actions. Community-maintained summaries, curated highlights, related feedback, avatars from external providers, and popularity rankings remain outside this change. Manager response/category tools are disclosed on demand; authorization and conflict checks remain mandatory. Form input stays in memory only; reloading or leaving a form may discard unsaved input. Draft persistence, restoration, and offline replay are outside the current scope.

- V1-U01: Use the Opine identity: a gold O-shaped ring enclosing a pine tree, followed by lowercase "pine". Together they read Opine. Use a native SVG mark that remains clear at header size. The accessible name "Opine" shall remain available independently of the stylized letters.
- V1-U02: Primary participation actions shall be adding a typed contribution and following updates. Agree / Disagree remains an optional secondary action, with separate counts and visible labels alongside any icons; disagreement shall not be styled as an error. Contribution-type choices and discussion filters shall support keyboard use and clearly indicate selection. Discussion guidance shall welcome supporting and differing views.
- V1-U03: Prioritize desktop composition for this iteration. Retain a simple narrow-screen layout that stacks the supporting column, wraps controls, and keeps ordinary content readable without horizontal page scrolling. A separate mobile navigation or mobile-specific redesign is deferred. Primary actions shall support keyboards, accessible names, and visible focus indicators.
- V1-U04: Text and controls shall meet WCAG 2.2 AA contrast requirements. Status and official-response identification shall not rely on color alone.
- V1-U05: Forms shall identify invalid fields and preserve entered content after validation errors.

## Technical and operational baseline

- V1-T01: Publish the source under an open-source license and document installation, configuration, upgrades, and routine operation for a single-community deployment.
- V1-T02: Enforce authorization for every protected read and write, including category history, lock/archive actions, role changes, and notifications.
- V1-T03: Validate user input and render it without executing embedded active content. Protect sign-in and sessions, and support encrypted transport in deployment.
- V1-T04: Apply configurable limits to sign-in attempts, post creation, commenting, and official publication. Post creation allows one successful post per member per 60 seconds by default; creation limits use existing stored content. Edit, reaction, and follow operations do not require separate request-history counters.
- V1-T05: Mutations shall not retry automatically. After an uncertain response, the interface shall advise checking saved content before submitting again. Post cooldowns and edit/workflow versions prevent immediate duplicate posts and stale edits; repeated unversioned creates may produce duplicates. Reactions, follows, and read markers set the requested state without replay records.
- V1-T06: Concurrent edits and status updates shall detect conflicts before silently overwriting another user's change.
- V1-T07: Current content, edit markers and versions, accounts, roles, reactions, statuses, follows, notifications, post lock/archive state, and application events shall persist across service restarts.
- V1-T08: Lists, discussions, audit records, and work queues shall load in bounded pages or batches.
- V1-T09: Document backup and restoration of all persistent records and installation configuration. Verify recovery of a working installation through a documented restoration check before release.
- V1-T10: Record operational errors without exposing credentials or archived content.
- V1-T11: Keep private account information out of public profiles, contributions, and history. Document account deletion, attribution, and retention behavior, including how an operator handles deletion requests; a self-service deletion interface is not required in v1.
- V1-T12: Use Nuxt and TypeScript for a client-rendered SPA (`ssr: false`) and Nitro server endpoints in one Node application deployment. Access PostgreSQL only from server code, using Drizzle and reviewed, committed SQL migrations. Authentication callbacks and sessions shall run on the server under the same origin as the SPA.
- V1-T13: Use Better Auth with its Drizzle adapter for PostgreSQL and database-backed sessions. Enable its built-in Discord provider as the only v1 sign-in method. Use internal Opine user IDs for authorship, roles, and participation history, with external provider identities linked to those users. Retain Better Auth's extension path for future OAuth/OIDC providers or custom authentication plugins without changing feedback ownership or Opine's authorization model. Future account linking shall require explicit authenticated proof of ownership rather than automatic matching by name or email. A Daybreak integration depends on a supported identity interface supplied by that team and is not part of v1.

## Application event log

- V1-T14: Record successful post creation/editing, comments, official publication, moderation, category corrections, reactions, follows, tag management and role changes in an internal append-only event log. Commit each event with its mutation and omit unchanged operations. Store typed event metadata rather than content copies, secrets or complete requests. A nullable actor reference explicitly identifies system actions; preserve human references when accounts are retained. There is no public event endpoint or log UI in this release. See [event log](docs/events.md) for the schema and event vocabulary.

## Explicitly deferred

These are possible later additions, not a committed roadmap:

- Community curators, separate volunteer moderator permissions, maintained summaries, source-linked summary points, and highlights.
- Nested replies, separate conversation threads, and manually featured responses. Typed contributions and discussion filters are included in v1.
- Tag-based filtering, automatic similar-post suggestions, related or duplicate links, merged counts, and moving discussions.
- Reports and private report queues, individual comment/official-response hiding and restoration, account suspensions, moderation reasons/action-history UI, and appeals/review-contact workflows.
- An archive browser and unarchive UI. Archiving retains data but removes it from application views.
- Assignments, internal notes, saved queues, analytics, popularity feeds, and per-manager read tracking.
- Discord bots, automatic cross-posting, conversation imports, and notifications outside the application. Discord sign-in is included in v1.
- Additional sign-in providers, including a potential Daybreak integration, and an account-linking interface. The identity model and authentication tooling shall allow these to be added later.
- Attachments, rich text editing, profile customization, and an interactive branding editor.
- Application-level content exports and multi-community hosting in one installation. Full operational backups remain required.
- Bug-report diagnostic fields, persisted drafts, restoration of unsaved forms, offline replay and a separate mobile redesign. Basic narrow-screen readability and accessibility remain required.
- A self-service account-deletion interface. A documented operator process for deletion/anonymization requests and contribution retention remains required.

CI automation is included in the Railway hosting trial. The workflow runs local-equivalent validation before deployment; hosted CI, deployment and release checks still need verification as recorded in [the implementation checklist](docs/TODO.md).

## First-release acceptance

A player can find or submit feedback; another player can choose a contribution type and add context, a different view, a suggestion, or a question. Readers can filter those contributions and find official responses without scanning the entire discussion. A CM can acknowledge the feedback and respond with a visible status and explanation, and followers can see the response and eventual outcome. Agree / Disagree remains available without driving ranking or obscuring substantive contributions. This works without a curator. Basic moderation, access controls, accessibility, and a successful backup restoration are part of release readiness.

Before a public pilot, provide CM lock/unlock and archive controls with consistent server enforcement across content, direct links, work queues and notifications. Complete community configuration and rules, the operator retention process, production sign-in checks and accessibility verification. Record a successful backup restoration, rather than treating a service restart as proof of recovery. Publish Opine under the [MIT License](LICENSE), preserving third-party license notices. The broader moderation features listed above are not prerequisites for this initial release.
