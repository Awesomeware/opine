# Opine — first-version user journeys

These journeys cover only the reduced first version in [requirements.md](requirements.md). `V1-` identifiers replace the broader draft's journey identifiers.

## Discover feedback

- V1-J01: As a visitor, I can browse recent feedback and read posts, comments, and official responses without signing in.
- V1-J02: As a visitor, I can search feedback and filter it by category or status before deciding whether to post.
- V1-J03: As a visitor, I can open a shared link to a post, comment, or official response and understand its context.

## Share an experience

- V1-J04: As a community member, I can sign in with Discord and submit a title, my experience, one category, and an optional desired improvement without supplying bug-report metadata.
- V1-J05: As a community member, I can edit my own post or ordinary comment, with previous versions accessible in its history unless moderation restricts them.
- V1-J06: As a community member, I can add or remove one "I've experienced this" confirmation on a post.
- V1-J07: As a community member, I can add a flat comment describing a supporting or different experience, an idea, or a question.
- V1-J08: As a visitor, I can read the full chronological discussion, including disagreements and earlier official responses.

## Follow the outcome

- V1-J09: As a visitor, I can see the current status and latest visible official response without reading the entire discussion, and distinguish planned, delivered, declined, and explanation-only outcomes.
- V1-J10: As a community member, I automatically follow my new posts and can follow or unfollow any post.
- V1-J11: As a follower, I can receive an in-platform notification for an official response and any accompanying status change, open the response directly, and mark the notification as read.

## Manage and respond to feedback

- V1-J12: As a community manager, I can work through New posts oldest first and filter the queue by category or status.
- V1-J13: As a community manager, I can find posts where players have added comments since the latest official response, without personal read tracking or assignments.
- V1-J14: As a community manager, I can correct a post's category with the change recorded in its history.
- V1-J15: As a community manager, I can explicitly publish an official response that appears above the discussion, including a focused question when I need more examples. I can also participate through ordinary comments without an official badge.
- V1-J16: As a community manager, I can change a post's status with an accompanying official explanation, revisit any outcome, and leave discussion open. Earlier responses and status changes remain accessible; a correction uses a new official response.

## Moderate and administer

- V1-J17: As a community member, I can read community rules and privately report a post, comment, or official response with a reason.
- V1-J18: As a community manager, I can review reports, record their outcomes, hide or restore content, and suspend or restore participation, with moderation reasons recorded.
- V1-J19: As an affected member, I can read the reason for a moderation action and find an external contact to request review, including while my participation is suspended.
- V1-J20: As an administrator, I can grant and revoke privileged roles without automatically making my own contributions official.
- V1-J21: As an administrator, I can configure the installation's name, categories, rules, community link, and moderation-review contact through the documented configuration mechanism.

## Operate an independent installation

- V1-J22: As an operator, I can install and upgrade Opine for one community, back up its data and configuration, and verify restoration using the documentation.

## Pilot walkthrough

1. A player follows a link from Discord, searches existing feedback, and signs in with Discord to submit an experience if it is not already represented.
2. Another player confirms the experience; a third adds a comment explaining a different experience.
3. A CM finds the post in the New queue and publishes an official response, changing its status if appropriate.
4. The author and other followers receive one notification for the official update.
5. New player comments after that response bring the post into the CM follow-up filter.
6. The CM records the outcome with an explanation, distinguishing a planned or delivered change from a declined change or an explanation-only answer.

The walkthrough requires no curator, summary, duplicate merge, or Discord bot integration. Removed workflows are listed under "Explicitly deferred" in the requirements and are not first-release acceptance criteria.
