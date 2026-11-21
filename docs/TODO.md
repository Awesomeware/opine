# Implementation checklist

First milestone complete: **a player signs in with Discord, submits feedback, and shares a public link that works after a restart.**

Work through these steps individually. Each step should include its schema changes, UI, endpoints, and relevant tests. The [requirements](../requirements.md) define the release scope.

The core feedback loop and steps 1–5b are implemented. The next work is **#6: basic moderation**, beginning with a schema and visibility-rule proposal for review before implementation. Steps 6–9 are prerequisites for a public pilot; the license is required before publishing the repository. CI is explicitly deferred.

## 1. Make local development reproducible

- [x] Add PostgreSQL through Docker Compose.
- [x] Wire up the server-side database connection.
- [x] Establish the Drizzle migration workflow.
- CI remains deferred; run the documented checks locally.

## 2. Implement authentication and permissions

- [x] Connect Better Auth to PostgreSQL and Discord.
- [x] Add sign-in, sign-out, and session handling.
- [x] Use internal Opine user IDs with linked login identities.
- [x] Establish member, community-manager, and administrator permissions.
- [x] Document how to grant the first administrator access.
- [x] Test authorization boundaries.

## 3. Build the first complete feedback flow

- [x] Add categories and posts.
- [x] Implement the public feedback list and detail page.
- [x] Implement the authenticated submission form.
- [x] Establish the initial screens; the [approved visual direction](design/README.md) applied in #5a is now authoritative.
- [x] Include input validation, pagination, and useful loading and error states.
- [x] Verify the first milestone end to end, including persistence after a restart.

## 4. Add participation

- [x] Implement flat comments.
- [x] Implement adding, changing, and removing Agree / Disagree reactions.
- [x] Enforce one reaction per user per post with database constraints.
- [x] Add author editing with an Edited indicator and no retained text history.
- [x] Detect conflicting edits and handle uncertain responses without automatic mutation retries; enforce post cooldowns using existing timestamps.

## 4a. Structure participation

The participation foundation and structured contributions are implemented.

- [x] Require an explicit choice of Context or example, Different view, Suggestion, or Question for new ordinary contributions.
- [x] Show type-specific composer guidance and display the chosen type on each contribution.
- [x] Add All, Context, Different views, Suggestions, and Questions filters with chronological, bounded pagination over all matching contributions.
- [x] Preserve stable contribution links and context when switching filters.
- [x] Keep Agree / Disagree visually secondary to contributing and following the outcome; preserve separate counts and existing reaction behavior.
- [x] Define compatibility for existing untyped comments without losing content or inventing an author's chosen type.
- [x] Test required type selection, validation, filtering beyond the first page, direct links, and existing-comment compatibility.

## 5. Make the team response and outcome explicit

- [x] Add the oldest-first review queue, category/status filters, and member follow-up filtering.
- [x] Add community-manager category corrections with a separate audit record.
- [x] Add explicit official responses, distinct from ordinary typed contributions even when authored by a CM.
- [x] Present the proposal, a prominent status and latest official-response panel, then community contributions; show clearly when feedback is awaiting initial review or has no official response.
- [x] Add Official responses to the discussion filters and include official responses in All; keep the featured response and current status visible regardless of filter.
- [x] Record status changes alongside their official explanation, and keep the current status explanation accessible even after later responses.
- [x] Add follow/unfollow controls and notifications so players can see the outcome.
- [x] Verify the full journey from a typed contribution to acknowledgement, official response, and follower notification, including the distinction between ordinary CM comments and official responses.

Discussion filters organize one flat discussion. See [deferred work](#deferred-and-outside-the-current-release) for excluded features.

## 5a. Apply the approved visual direction

- [x] Align the documented scope and logo with the [approved mockup](design/README.md).
- [x] Apply shared typography, colors, controls, and the enclosed-tree wordmark.
- [x] Add the O-and-tree browser favicon.
- [x] Use compact feedback rows and a search/filter toolbar.
- [x] Distinguish proposal, official response, and contributions; place status/follow controls alongside the proposal on desktop.
- [x] Keep manager tools available on demand and preserve existing workflows.
- [x] Verify isolated stories and full application journeys, with a basic narrow-screen check.

## 5b. Add author-selected tags

- [x] Add admin-defined tags and optional post assignments, with the five initial tags.
- [x] Let administrators create, rename, disable, and re-enable tags.
- [x] Let authors select tags on creation and edit, with conflict protection and clear handling of uncertain responses; form state is not persisted.
- [x] Display tags in feedback rows and detail views using the existing visual direction.
- [x] Verify authorization, migrations, reset/seed behavior, isolated controls, and full journeys.

## 6. Add basic moderation — next

Initial moderation is limited to CM lock/unlock and archive actions on whole feedback posts. The proposed schema is two nullable timestamps on `feedback_post`: `locked_at` and `archived_at`. Review these semantics before implementation; no report, suspension or moderation-history tables are planned.

- [ ] Add CM lock/unlock controls and a visible Locked indicator. Locked posts remain readable; block post/comment edits, new comments, reaction changes, official publication/status changes and category corrections until unlocked. Following/unfollowing and reading notifications remain available for locked posts.
- [ ] Add a CM archive action that sets `archived_at`, retaining the stored post and its related records. Archiving also makes all related content inaccessible through the application.
- [ ] Exclude archived posts from public lists/search, direct links, discussion/comment/response reads, outcome/reaction reads, CM review queues, notifications and unread counts. Direct links return the usual unavailable/not-found result, including for CMs. Do not add an archive browser or unarchive UI.
- [ ] Reject application writes to archived posts and their content, and prevent official-response notification fanout for archived posts. Lock/unlock/archive actions themselves do not notify followers.
- [ ] Keep these actions in the existing feedback review capability. Reuse post locking and ordinary transaction-taking operations to serialize content writes with lock/archive decisions; retain request-time CM authorization.
- [ ] Test CM-only actions, administrator-only denial, locked write rejection and unlocking, archive visibility across all affected reads, notification suppression, persistence and preservation of stored content.

Reports, individual comment/response hiding, account suspension, moderation reasons/history and appeals are deferred beyond this initial release scope.

## 7. Complete community configuration

Completes V1-F28. Categories, privileged-role management and tags already have supported management paths.

- [ ] Provide documented configuration for the public name, community rules and community link.
- [ ] Surface that configuration in the relevant public views. Moderation-review contact and appeals UI are deferred.
- [ ] Document the complete installation configuration alongside the existing category, role and tag commands/UI. A full settings or branding editor is not required.

## 8. Complete operational readiness and retention

Completes the remaining operational work in V1-T01, T03, T09–T11 and T13.

- [ ] Document production installation, upgrades, HTTPS/proxy configuration and routine operation, building on the existing setup instructions.
- [ ] Verify Discord sign-in, session reload and sign-out on the deployed HTTPS origin; automated provider fixtures do not replace this check.
- [ ] Document backups of PostgreSQL and installation configuration, and the restoration procedure.
- [ ] Perform and record a successful restoration into an isolated installation, verifying content, accounts, permissions and post lock/archive state. Restart persistence alone is not a restoration check.
- [ ] Define and document an operator process for account deletion/anonymization requests that preserves contributions and explains attribution and retention. No self-service deletion UI is required.
- [ ] Verify operational error reporting does not expose credentials or archived content.

## 9. Verify release acceptance

- [ ] Complete keyboard, accessible-name, focus, contrast, error-state and non-color-only status checks against V1-U02–U05, including moderation screens and basic narrow-screen layout.
- [ ] Run the full local validation set and the [pilot walkthrough](../journeys.md#pilot-walkthrough), including moderation and configuration journeys, on the release candidate.
- [ ] Record deployment, accessibility and restoration evidence; resolve remaining gaps against [first-release acceptance](../requirements.md#first-release-acceptance) before a public pilot.

## Before publishing the repository

- [ ] Choose and add the open-source license.

## Deferred and outside the current release

The canonical product exclusions are in [Explicitly deferred](../requirements.md#explicitly-deferred). They are possible later additions, not release prerequisites or a committed roadmap:

- Summaries, curated highlights, curator roles, nested replies and separate threads.
- Tag filtering, duplicate suggestions/merging, related feedback, popularity rankings and advanced queue tools.
- Reports/private report queues, individual contribution hiding/restoration, account suspensions, moderation reasons/action history, appeals/review contact and an unarchive UI.
- Additional identity providers, Discord bots/imports/cross-posting, and email/push/Discord notifications.
- Attachments, rich text, profile/branding editors, application-level exports and multi-community hosting.
- Bug-report diagnostics, persisted drafts/offline replay, a separate mobile redesign and self-service account deletion.

CI automation remains deferred separately from product scope. Local checks, accessibility verification, backups and a demonstrated restoration remain required for this release.
