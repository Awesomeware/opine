# Implementation checklist

First milestone complete: **a player signs in with Discord, submits feedback, and shares a public link that works after a restart.**

Work through these steps individually. Each step should include its schema changes, UI, endpoints, and relevant tests. The [requirements](../requirements.md) define the release scope.

The core feedback loop and steps 1–9 are complete locally; see the [release acceptance evidence](release-acceptance.md). The next work is **#10: final deployment and retention checks**, required before a public pilot. The repository is licensed under [MIT](../LICENSE). Render deployment files and CI configuration are prepared on the `render` branch; deployment verification remains outstanding.

## 1. Make local development reproducible

- [x] Add PostgreSQL through Docker Compose.
- [x] Wire up the server-side database connection.
- [x] Establish the Drizzle migration workflow.
- CI configuration is included in the Render deployment; retain local checks during development.

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

- [x] Add admin-defined tags and optional post assignments, with the thirteen EQ: Legends tags and optional decorative icons.
- [x] Let administrators create, rename, set or clear icons, disable, and re-enable tags.
- [x] Let authors select tags on creation and edit, with conflict protection and clear handling of uncertain responses; form state is not persisted.
- [x] Display tags in feedback rows and detail views using the existing visual direction.
- [x] Verify authorization, migrations, reset/seed behavior, isolated controls, and full journeys.

## 6. Add basic moderation

Initial moderation is limited to CM lock/unlock and archive actions on whole feedback posts. The schema adds two nullable timestamps on `feedback_post`: `locked_at` and `archived_at`, plus an internal [event log](events.md) shared by business operations.

- [x] Add CM lock/unlock controls and a visible Locked indicator. Locked posts remain readable; block post/comment edits, new comments, reaction changes, official publication/status changes and category corrections until unlocked. Following/unfollowing and reading notifications remain available for locked posts.
- [x] Add a CM archive action that sets `archived_at`, retaining the stored post and its related records. Archiving also makes all related content inaccessible through the application.
- [x] Exclude archived posts from public lists/search, direct links, discussion/comment/response reads, outcome/reaction reads, CM review queues, notifications and unread counts. Direct links return the usual unavailable/not-found result, including for CMs. Do not add an archive browser or unarchive UI.
- [x] Reject application writes to archived posts and their content, and prevent official-response notification fanout for archived posts. Lock/unlock/archive actions themselves do not notify followers.
- [x] Keep these actions in the existing feedback review capability. Reuse post locking and ordinary transaction-taking operations to serialize content writes with lock/archive decisions; retain request-time CM authorization.
- [x] Test CM-only actions, administrator-only denial, locked write rejection and unlocking, archive visibility across all affected reads, notification suppression, persistence and preservation of stored content.
- [x] Append typed metadata for moderation and business mutations to `event_log` in the same transaction. Preserve human actor references; NULL identifies system actions. Keep the log internal, without content snapshots or an event-history UI.

Reports, individual comment/response hiding, account suspension, moderation reasons/history UI and appeals are deferred beyond this initial release scope.

## 7. Complete community configuration

Completes V1-F28. [Community configuration](community.md) documents installation files for public settings alongside existing category, privileged-role and tag management.

- [x] Provide documented JSON configuration for the public name and community link, and a Markdown file for community rules.
- [x] Surface that configuration in the relevant public views. Moderation-review contact and appeals UI are deferred.
- [x] Document the complete installation configuration alongside the existing category, role and tag commands/UI. A full settings or branding editor is not required.

## 8. Complete deployment and recovery

Covers deployment and recovery work in V1-T01, T03 and T09–T11. Final deployed checks and retention are in #10.

- [x] Document production installation, upgrades, HTTPS/proxy configuration and routine operation, building on the existing setup instructions.
- [x] Document backups of PostgreSQL and installation configuration, and the restoration procedure. Provide `pnpm backup` and `pnpm restore` using PostgreSQL's native tools.
- [x] Perform and record a successful restoration into an isolated installation, verifying content, accounts, permissions and post lock/archive state. See [restoration evidence](deployment.md#restoration-evidence). Restart persistence alone is not a restoration check.

## 9. Verify release acceptance

- [x] Complete keyboard, accessible-name, focus, contrast, error-state and non-color-only status checks against V1-U02–U05, including moderation screens and basic narrow-screen layout. Adopt the [semantic HTML and focus conventions](ui.md#accessibility).
- [x] Run the full local validation set and the [pilot walkthrough](../journeys.md#pilot-walkthrough), including moderation and configuration journeys, on the release candidate. Local browser journeys use isolated authenticated fixtures; real Discord consent remains in #10.
- [x] Record local validation, accessibility and restoration evidence against [first-release acceptance](../requirements.md#first-release-acceptance). See the [results and verification limits](release-acceptance.md). Complete the final deployed checks and retention process in #10 before a public pilot.

## 10. Complete final deployment and retention checks

Required before a public pilot. Completes the Render deployment setup, deployed checks and operator retention work, including V1-T13. See [Render deployment](render.md) for setup and deployment boundaries.

- [x] Add a reproducible application image, Render Blueprint, deployment guide and GitHub CI workflow on the `render` branch.
- [ ] Apply the Render Blueprint with the connected GitHub repository and source branch `render`, enable After CI Checks Pass, and observe successful hosted CI and deployment. Local checks do not prove these integrations.
- [ ] Configure PostgreSQL recovery, retain installation secrets/configuration, rehearse restoration and verify monitoring and spending alerts before public use.
- [ ] Verify Discord sign-in, session reload and sign-out on the deployed HTTPS origin; automated provider fixtures do not replace this check.
- [ ] Verify operational error reporting does not expose credentials or archived content.
- [ ] Define and document an operator process for account deletion/anonymization requests that preserves contributions and explains attribution and retention. No self-service deletion UI is required.

## Before publishing the repository

- [x] License Opine under [MIT](../LICENSE), preserving third-party license notices.

## Planned follow-up: Updated indicator

- [ ] Show **Updated** only for signed-in users who have opened that post before, when new comments, official responses or status changes arrive afterward.
- [ ] Opening the post catches up. Never-opened posts have no badge. Post/comment edits and reactions do not trigger it.
- [ ] Keep this separate from follower notification unread state. Read tracking is not implemented yet and is not a pilot release prerequisite.

## Deferred and outside the current release

The canonical product exclusions are in [Explicitly deferred](../requirements.md#explicitly-deferred). They are possible later additions, not release prerequisites or a committed roadmap:

- Summaries, curated highlights, curator roles, nested replies and separate threads.
- Tag filtering, duplicate suggestions/merging, related feedback, popularity rankings and advanced queue tools.
- Reports/private report queues, individual contribution hiding/restoration, account suspensions, moderation reasons/action-history UI, appeals/review contact and an unarchive UI.
- Additional identity providers, Discord bots/imports/cross-posting, and email/push/Discord notifications.
- Attachments, rich text, profile/branding editors, application-level exports and multi-community hosting.
- Bug-report diagnostics, persisted drafts/offline replay, a separate mobile redesign and self-service account deletion.

CI and the documented deployment workflow are included in the Render deployment. A successful hosted run and the deployed checks above remain outstanding; local checks, accessibility verification, backups and a demonstrated restoration still apply.
