# Implementation checklist

First milestone: **a player signs in with Discord, submits feedback, and shares a public link that works after a restart.**

Work through these steps individually. Each step should include its schema changes, UI, endpoints, and relevant tests. The [requirements](../requirements.md) define the release scope.

## 1. Make local development reproducible

- [x] Add PostgreSQL through Docker Compose.
- [x] Wire up the server-side database connection.
- [x] Establish the Drizzle migration workflow.
- (SKIPPED FOR NOW) Add CI for formatting, linting, typechecking, and builds.

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
- [x] Apply the [simplified visual reference](../example-simplified.png) as these screens take shape.
- [x] Include input validation, pagination, and useful loading and error states.
- [x] Verify the first milestone end to end, including persistence after a restart.

## 4. Add participation

- [x] Implement flat comments.
- [x] Implement adding, changing, and removing Agree / Disagree reactions.
- [x] Enforce one reaction per user per post with database constraints.
- [x] Add author editing with an Edited indicator and no retained text history.
- [x] Handle retried writes and conflicting edits.

## 4a. Structure participation

The participation foundation in #4 is implemented. These additions restore the agreed structure before completing #5.

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

Community-maintained summaries, curated highlights, nested replies, and separate conversation threads remain deferred. Discussion filters organize one flat discussion.

## 5a. Apply the approved visual direction

- [x] Align the documented scope and logo with the [approved mockup](design/README.md).
- [x] Apply shared typography, colors, controls, and the enclosed-tree wordmark.
- [x] Use compact feedback rows and a search/filter toolbar.
- [x] Distinguish proposal, official response, and contributions; place status/follow controls alongside the proposal on desktop.
- [x] Keep manager tools available on demand and preserve existing workflows.
- [x] Verify isolated stories and full application journeys, with a basic narrow-screen check.

## 5b. Add author-selected tags

- [ ] Add admin-defined tags and optional post assignments, with the five initial tags.
- [ ] Let administrators create, rename, disable, and re-enable tags.
- [ ] Let authors select tags on creation and edit, with draft, retry, and conflict protection.
- [ ] Display tags in feedback rows and detail views using the existing visual direction.
- [ ] Verify authorization, migrations, reset/seed behavior, isolated controls, and full journeys.

## Before a public pilot

- [ ] Implement the basic moderation requirements.
- [ ] Complete operational readiness, including documented backup and restoration and a successful restoration check.

## Before publishing the repository

- [ ] Choose and add the open-source license.
