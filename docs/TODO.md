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

- [ ] Implement flat comments.
- [ ] Implement adding and removing an "I've experienced this" confirmation.
- [ ] Enforce one confirmation per user per post with database constraints.
- [ ] Add author editing with revision history.
- [ ] Handle retried writes and conflicting edits.

## 5. Complete the CM response loop

- [ ] Add the oldest-first review queue.
- [ ] Add explicit official responses.
- [ ] Record status changes alongside their official explanation.
- [ ] Add follow/unfollow controls and notifications so players can see the outcome.

## Before a public pilot

- [ ] Implement the basic moderation requirements.
- [ ] Complete operational readiness, including documented backup and restoration and a successful restoration check.

## Before publishing the repository

- [ ] Choose and add the open-source license.
