# Opine — first-version requirements

## Product goal

Give player feedback a durable home where other players can add their experiences, community managers can respond, and participants can follow the outcome.

The first version must work without volunteer curation. Its core loop is: submit an experience → add perspectives → receive an official response → follow the outcome.

This is the first-release boundary, replacing the broader draft. `V1-` identifiers belong to this reduced scope. Deferred features are not prerequisites for release.

## Scope and operating model

- V1-S01: Support feedback about player experiences and proposed improvements. A player shall not need to propose a solution to describe a concern.
- V1-S02: Bug reporting and diagnostic fields, including game version, platform, and reproduction steps, are outside scope.
- V1-S03: Preserve substantive criticism and differing experiences. Experience confirmations indicate participation, not a representative survey or a promise of priority.
- V1-S04: Serve one community per installation. Independent communities can operate their own installations and data.
- V1-S05: Community managers handle official responses and basic moderation in v1. Administrators manage access and installation settings. There is no separate curator or volunteer moderator role in this version.
- V1-S06: Fit alongside the community's existing Discord through Discord sign-in and ordinary links. Discord bots, automatic cross-posting, and migration of existing conversations are not required.

## Access and roles

- V1-F01: Visitors shall be able to browse, search, and read public feedback, comments, and official responses without signing in.
- V1-F02: Members shall sign in before posting, commenting, confirming an experience, following feedback, or reporting content. Discord shall be the only enabled sign-in method in v1. Public contributions shall identify members by a display name.
- V1-F03: Support member, community manager, and administrator roles. An account may hold multiple roles; privileged accounts retain ordinary member capabilities.
- V1-F04: Only community managers shall publish official responses, change feedback statuses, review reports, or moderate content and participation. Administrative access alone shall not confer these powers or make contributions official.

## Feedback and discussion

- V1-F05: Each feedback post shall contain a title, experience description, optional desired improvement, one category, author, creation time, and current status. New posts shall start as New.
- V1-F06: Each member shall be able to add or remove one "I've experienced this" confirmation per post. Counts shall represent distinct confirming accounts. There shall be no downvotes or comment reactions.
- V1-F07: Members shall be able to add flat comments containing supporting experiences, different experiences, suggestions, or questions. Comments shall not require a contribution type or support nested replies. Plain text with links is sufficient; attachments and a rich text editor are outside v1.
- V1-F08: A post's discussion shall display all permitted comments and official responses in chronological order, with author and publication time. Comment volume shall not affect a post's placement in feedback lists.
- V1-F09: Authors shall be able to edit their own posts and ordinary comments. Edits shall display an edited indicator and retain accessible chronological revisions with editor and time. Visual diffs and revision restoration controls are not required.
- V1-F10: Posts, comments, and official responses shall have stable direct links suitable for sharing in Discord.
- V1-F11: Feedback pages shall display the original experience, the latest official response when present, and the full discussion in that order. No summary, highlights, or separate discussion views are required.

## Official responses and outcomes

- V1-F12: Publishing an official response shall be an explicit community-manager action. Ordinary comments from privileged accounts shall not automatically carry an official badge.
- V1-F13: Official responses shall display a distinct team badge and publication time. The latest response shall appear automatically above the discussion; earlier responses shall remain accessible in the discussion. Corrections shall use a new official response, preserving the earlier record unless moderation restricts it.
- V1-F14: Feedback shall use the following statuses:

| Status      | Meaning                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------- |
| New         | Awaiting initial review.                                                                 |
| Reviewing   | The team has acknowledged the feedback and is evaluating it, without promising a change. |
| Planned     | The team explicitly intends to make a change.                                            |
| Delivered   | The planned change is available to players.                                              |
| Not planned | The team has decided not to pursue a change at present, with an explanation.             |
| Answered    | The feedback is resolved through an explanation; no implementation decision is needed.   |

- V1-F15: A community manager shall be able to publish an official response with an optional status change. Every status change shall accompany an official response explaining it and retain the previous status, new status, representative, and time. Publishing a response alone shall not automatically change the status.
- V1-F16: Community managers shall be able to revisit feedback and change any status. Statuses shall not close discussion or prevent additional experience confirmations.

## Discovery and the CM work queue

- V1-F17: Public feedback lists shall show newest posts first and support text search of titles and experience descriptions, plus category and status filters. Automatic duplicate suggestions, tags, and popularity rankings are outside v1.
- V1-F18: Community managers shall have a work queue with category and status filters and oldest-first ordering, defaulting to New posts. A follow-up filter shall show posts with ordinary member comments newer than the latest official response, excluding comments from community managers. Posts without an official response belong in the initial-review queue rather than this follow-up filter. This is a shared queue, with no assignment or per-manager read tracking.
- V1-F19: Community managers shall be able to correct a post's category, recording the actor, time, and previous category in its history.

## Following and notifications

- V1-F20: Members shall be able to follow and unfollow posts. Authors shall automatically follow their own new posts and may unfollow them.
- V1-F21: Followers shall receive in-platform notifications for new official responses, including any accompanying status change. A combined response and status change shall produce one notification per follower, linked to that response.
- V1-F22: Members shall be able to see unread notifications and mark them as read. Ordinary comments shall not trigger notifications in v1; email, push, and Discord delivery are deferred.

## Basic moderation and administration

- V1-F23: The installation shall publish community rules distinguishing criticism and disagreement from prohibited conduct. Negative sentiment alone shall not justify moderation.
- V1-F24: Members shall be able to report a post or comment with a reason, including official responses. Community managers shall have a private report queue and record an outcome and explanation when resolving a report. Report details shall not be public.
- V1-F25: Community managers shall be able to hide or restore posts and comments, including official responses, and suspend or restore an account's ability to participate. Suspended accounts shall retain read access and access to moderation reasons and the review contact.
- V1-F26: Moderation actions shall retain actor, time, target, action, and reason. Hidden content shall leave a visible moderation notice. Hiding a post shall also restrict its discussion; hidden text and revisions shall not remain available through public links, search, or notifications. The featured response shall always be the latest visible official response. Only community managers shall be able to inspect restricted content and private reports.
- V1-F27: Affected members shall be able to see the moderation reason and a configured external contact for requesting review. A dedicated appeals workflow is outside v1.
- V1-F28: Administrators shall have a documented way to grant and revoke community-manager and administrator roles. Installation configuration shall provide the public name, categories, rules, community link, and moderation-review contact. A full settings or branding editor is not required.

## Presentation and accessibility

Use [example-simplified.png](example-simplified.png) as the primary visual target. Preserve its centered single-column layout, dark navy surfaces, restrained gold accents, serif headings, readable sans-serif body text, subtle panel borders, and teal treatment for official responses. Place status and counts near the post's primary actions, followed by the latest official response, flat chronological discussion with incremental loading, and a plain comment form.

The image does not expand the feature scope. Replace the pictured "Seeking examples" status with an applicable v1 status such as Reviewing; requests for examples belong in the official response. Navigation shall reflect v1 features; the pictured "Team updates" link does not require a separate updates feed. The pictured EQ: Legends wordmark illustrates community branding; the product identity remains Opine. The earlier [example.png](example.png) is retained as background reference only; its summary, related-feedback panel, tags, discussion tabs, and contribution-type controls remain deferred.

- V1-U01: Use the Opine identity, with an o followed by a pine tree mark, a dark visual direction, restrained gold accents, and distinct official responses. The readable name "Opine" shall remain available to assistive technology and in text contexts.
- V1-U02: Primary actions shall be "I've experienced this", following updates, and adding a comment. Discussion guidance shall welcome both supporting and differing experiences.
- V1-U03: Ordinary content shall work on desktop and mobile without horizontal scrolling. Primary actions shall support keyboards, accessible names, and visible focus indicators.
- V1-U04: Text and controls shall meet WCAG 2.2 AA contrast requirements. Status and official-response identification shall not rely on color alone.
- V1-U05: Forms shall identify invalid fields and preserve entered content after validation errors.

## Technical and operational baseline

- V1-T01: Publish the source under an open-source license and document installation, configuration, upgrades, and routine operation for a single-community deployment.
- V1-T02: Enforce authorization for every protected read and write, including history, moderation records, role changes, and notifications.
- V1-T03: Validate user input and render it without executing embedded active content. Protect sign-in and sessions, and support encrypted transport in deployment.
- V1-T04: Apply configurable rate limits to sign-in attempts, posting, commenting, confirmations, and reports.
- V1-T05: Retrying the same submission shall not duplicate posts, comments, confirmations, official updates, or notifications.
- V1-T06: Concurrent edits and status updates shall detect conflicts before silently overwriting another user's change.
- V1-T07: Content, accounts, roles, revisions, confirmations, statuses, follows, notifications, and moderation records shall persist across service restarts.
- V1-T08: Lists, discussions, histories, and work queues shall load in bounded pages or batches.
- V1-T09: Document backup and restoration of all persistent records and installation configuration. Verify recovery of a working installation through a documented restoration check before release.
- V1-T10: Record operational errors without exposing credentials, private report details, or restricted content.
- V1-T11: Keep private account information out of public profiles, contributions, and history. Document account deletion, attribution, and retention behavior, including how an operator handles deletion requests; a self-service deletion interface is not required in v1.
- V1-T12: Use Nuxt and TypeScript for a client-rendered SPA (`ssr: false`) and Nitro server endpoints in one Node application deployment. Access PostgreSQL only from server code, using Drizzle and reviewed, committed SQL migrations. Authentication callbacks and sessions shall run on the server under the same origin as the SPA.
- V1-T13: Use Better Auth with its Drizzle adapter for PostgreSQL and database-backed sessions. Enable its built-in Discord provider as the only v1 sign-in method. Use internal Opine user IDs for authorship, roles, and participation history, with external provider identities linked to those users. Retain Better Auth's extension path for future OAuth/OIDC providers or custom authentication plugins without changing feedback ownership or Opine's authorization model. Future account linking shall require explicit authenticated proof of ownership rather than automatic matching by name or email. A Daybreak integration depends on a supported identity interface supplied by that team and is not part of v1.

## Explicitly deferred

These are possible later additions, not a committed roadmap:

- Community curators, separate volunteer moderator permissions, maintained summaries, source-linked summary points, and highlights.
- Contribution types, nested replies, separate discussion tabs, and manually featured responses.
- Tags, automatic similar-post suggestions, related or duplicate links, merged counts, and moving discussions.
- Formal curation and moderation appeals with dedicated review records and interfaces.
- Assignments, internal notes, saved queues, analytics, popularity feeds, and per-manager read tracking.
- Discord bots, automatic cross-posting, conversation imports, and notifications outside the application. Discord sign-in is included in v1.
- Additional sign-in providers, including a potential Daybreak integration, and an account-linking interface. The identity model and authentication tooling shall allow these to be added later.
- Attachments, rich text editing, profile customization, and an interactive branding editor.
- Application-level content exports and multi-community hosting in one installation. Full operational backups remain required.

## First-release acceptance

A player can find existing feedback or submit an experience, another player can confirm it and add a differing perspective, a CM can find and respond to it, and followers can see the response and eventual outcome. This works without a curator. Basic moderation, access controls, accessibility, and a successful backup restoration are part of release readiness.
