# Opine — first-version user journeys

These journeys cover only the reduced first version in [requirements.md](requirements.md). `V1-` identifiers replace the broader draft's journey identifiers.

These describe release acceptance, not a claim that every journey is already implemented. The [implementation checklist](docs/TODO.md) tracks completion; operational readiness and release verification are the next work.

## Discover feedback

- V1-J01: As a visitor, I can browse recent feedback and read posts, comments, and official responses without signing in.
- V1-J02: As a visitor, I can search feedback and filter it by category or status before deciding whether to post.
- V1-J03: As a visitor, I can open a shared link to a post, comment, or official response and understand its context.

## Contribute to feedback

- V1-J04: As a community member, I can sign in with Discord and submit a title, my feedback, one category, optional tags, and an optional suggested improvement without supplying bug-report metadata.
- V1-J05: As a community member, I can edit my own post text and tags or ordinary comment, with an Edited indicator and protection against conflicting edits, without retaining previous text.
- V1-J06: As a community member, I can choose, change, or remove one Agree / Disagree reaction on a post, with separate counts and no effect on visibility or ranking.
- V1-J07: As a community member, I can explicitly choose Context or example, Different view, Suggestion, or Question, see guidance for that choice, and add a flat contribution displaying its type.
- V1-J08: As a visitor, I can read All contributions chronologically or filter by Context, Different views, Suggestions, Questions, or Official responses, including results beyond the first page.

## Follow the outcome

- V1-J09: As a visitor, I can distinguish the author's proposal, current status, and latest visible official response without reading the entire discussion, see when acknowledgement is still pending, and distinguish planned, delivered, declined, and explanation-only outcomes.
- V1-J10: As a community member, I automatically follow my new posts and can follow or unfollow any post.
- V1-J11: As a follower, I can receive an in-platform notification for an official response and any accompanying status change, open the response directly, and mark the notification as read.

## Manage and respond to feedback

- V1-J12: As a community manager, I can work through New posts oldest first and filter the queue by category or status.
- V1-J13: As a community manager, I can find posts where players have added comments since the latest official response, without personal read tracking or assignments.
- V1-J14: As a community manager, I can correct a post's category with the actor, time, and previous category recorded in a category-change audit.
- V1-J15: As a community manager, I can explicitly publish an official response that appears above the discussion, including a focused question when I need more examples. I can also participate through ordinary comments without an official badge.
- V1-J16: As a community manager, I can change a post's status with an accompanying official explanation, revisit any outcome, and leave discussion open. Earlier responses and status changes remain accessible; a correction uses a new official response.

## Moderate and administer

- V1-J17: As a reader, I can read community rules and recognize a locked post; its existing content remains available while new contributions and edits are disabled.
- V1-J18: As a community manager, I can lock and unlock a feedback post to stop or resume edits, comments, reactions and official workflow changes.
- V1-J19: As a community manager, I can archive a feedback post so it and its discussion disappear from application views, direct links, review queues and notifications. The data remains stored, but there is no unarchive UI.
- V1-J20: As an administrator, I can grant and revoke privileged roles without automatically making my own contributions official.
- V1-J21: As an administrator, I can configure the installation's name, categories, rules and community link through the [documented configuration mechanism](docs/community.md), with public rules available without signing in.

- V1-J22: As an administrator, I can create, rename, disable, and re-enable tags. Disabled tags remain readable on existing posts, while authors choose which available tags describe their own feedback.

## Operate an independent installation

- V1-J23: As an operator, I can install and upgrade Opine for one community, back up its data and configuration, and verify restoration using the documentation.
- V1-J24: As an operator, I can follow the documented process for account deletion/anonymization requests while preserving contributions and handling attribution consistently.

## Pilot walkthrough

1. A player follows a link from Discord, searches existing feedback, and signs in with Discord to submit feedback if it is not already represented.
2. Other players explicitly choose types to add context, a different view, a suggestion, and a question. Readers filter these contributions; optional Agree / Disagree reactions remain secondary.
3. A CM finds the post in the New queue and explicitly publishes an official response, changing its status if appropriate. The proposal, status, and featured official response remain distinct while readers filter the discussion, including Official responses.
4. The author and other followers receive one notification for the official update.
5. New player comments after that response bring the post into the CM follow-up filter.
6. The CM records the outcome with an explanation, distinguishing a planned or delivered change from a declined change or an explanation-only answer.
7. A CM locks the post. Readers can still view the discussion and manage following, but attempts to edit, comment, react or publish official updates are rejected. The CM unlocks it and those actions become available again.
8. A CM archives the post. Verify it and its related content disappear from public and CM queries, shared links and notifications, including unread counts. No follower alert is generated, no new interaction is accepted, and the underlying records remain stored.

Separately verify the configured public name in the header, community link in the footer, and public `/rules` page reached from the footer and contribution forms. Also verify production Discord sign-in, accessibility, the operator retention process and a documented backup restoration. These release checks complement the product walkthrough.

The walkthrough requires no curator, summary, duplicate merge, or Discord bot integration. Removed workflows are listed under "Explicitly deferred" in the requirements and are not first-release acceptance criteria.
