# Requirements

## Scope

- S-01: The platform shall support community feedback about player experiences and proposed improvements.
- S-02: Bug reporting shall be outside the initial scope.
- S-03: The platform shall preserve substantive criticism and disagreement.
- S-04: The platform shall distinguish community curation from official team decisions.

## Access and roles

- F-01: Visitors shall be able to read public feedback without an account.
- F-02: Users shall sign in before posting, confirming an experience, following feedback, or submitting a report.
- F-03: The platform shall support community member, community curator, team representative, moderator, and administrator roles.
- F-04: An account shall be able to hold multiple roles.
- F-05: Community curators shall manage summaries, highlights, classifications, and discussion links.
- F-06: Only team representatives shall publish official responses or change official feedback statuses.
- F-07: Moderators shall manage content reports and participation restrictions.
- F-08: Administrators shall manage roles and platform settings.
- F-09: Administrative access shall not automatically label an account's contributions as official team responses.

## Feedback posts

- F-10: Each feedback post shall contain a title, author, experience description, category, creation time, and current status.
- F-11: Each feedback post shall support tags and an optional desired improvement.
- F-12: A proposed solution shall not be required to submit feedback.
- F-13: The platform shall suggest similar posts before a new post is published.
- F-14: Authors shall be able to edit their own posts.
- F-15: Post edits shall retain the previous content, editor, and edit time in a visible history.
- F-16: Each member shall be able to add or remove one experience confirmation per post.
- F-17: Experience confirmation shall optionally lead to a Shared experience contribution.
- F-18: Experience counts shall represent distinct confirming accounts rather than comments.
- F-19: Feedback posts shall not support downvotes.

## Contributions and discussion

- F-20: Contributions shall support Shared experience, Different experience, Suggestion, and Discussion types.
- F-21: Each contribution shall display its author, type, creation time, and edited state.
- F-22: Members shall be able to reply to individual contributions.
- F-23: Replies shall retain a link to the contribution they address.
- F-24: Authors shall be able to edit their own contributions with a visible edit history.
- F-25: Each contribution shall have a stable direct link.
- F-26: Each feedback page shall provide Highlights, All discussion, and Team replies views.
- F-27: Highlights shall contain contributions explicitly selected by community curators.
- F-28: All discussion shall display all contributions permitted by community rules in chronological order.
- F-29: Team replies shall display official team contributions in chronological order.
- F-30: Excluding a contribution from Highlights shall not hide it from All discussion.
- F-31: Highlight selection shall use relevance, concrete examples, reasoning, and distinct perspectives rather than positive sentiment.

## Summaries and curation

- F-32: Each feedback page shall support a community-maintained summary separate from the original post.
- F-33: Summaries shall support the concern, differing perspectives, ideas raised, and open questions.
- F-34: Summaries shall allow multiple differing perspectives without implying consensus.
- F-35: Each substantive summary point shall link to supporting posts or contributions.
- F-36: Summary edits shall display their editor, time, and revision history.
- F-37: Feedback pages without a summary shall remain usable and shall not display invented summary content.
- F-38: Highlight additions, highlight removals, reclassifications, and discussion moves shall record the actor, time, and reason.
- F-39: Related and duplicate posts shall remain accessible through visible links.
- F-40: Linking duplicate posts shall preserve their authorship, contributions, and direct links.
- F-41: Confirmation counts on linked posts shall remain separate unless accounts are explicitly deduplicated.
- F-42: Moved discussions shall retain links from both their original and new locations.
- F-43: Members shall be able to request review of summaries and curation decisions.
- F-44: Review requests shall retain the request, outcome, reviewer, and explanation.

## Team responses and statuses

- F-45: Feedback statuses shall be New, Reading, Seeking examples, Considering, Planned, and Answered.
- F-46: New posts shall start with the New status.
- F-47: Reading shall indicate acknowledgement without a commitment to change.
- F-48: Seeking examples shall indicate an outstanding team request for player input.
- F-49: Considering shall indicate active evaluation without a commitment to delivery.
- F-50: Planned shall indicate an explicit intention to make a change.
- F-51: Answered shall indicate that the team has provided an explanation or decision.
- F-52: Answered posts shall remain open to further contributions unless moderation restricts them.
- F-53: Status changes shall record the representative, time, previous status, new status, and explanation.
- F-54: Official responses shall display a distinct team badge and publication time.
- F-55: Each feedback page shall display a featured official response when one exists.
- F-56: Featuring a newer response shall preserve access to earlier official responses.
- F-57: Team representatives shall be able to revisit feedback and change its status.
- F-58: Community curator requests shall not appear as official team requests.

## Discovery and notifications

- F-59: Members and visitors shall be able to search feedback titles and post content.
- F-60: Feedback lists shall support category, tag, and status filters.
- F-61: Recent shall order posts by creation time.
- F-62: Most experienced shall order posts by distinct experience confirmations.
- F-63: Seeking player input shall show posts with the Seeking examples status.
- F-64: Team responded shall order posts by their latest official response time.
- F-65: Comment volume shall not determine feedback prominence.
- F-66: Members shall be able to follow and unfollow individual posts.
- F-67: Followers shall receive in-platform notifications for new official responses and status changes.
- F-68: Notifications shall link directly to the relevant response or status change.
- F-69: Members shall be able to mark notifications as read.

## Moderation

- F-70: The platform shall publish community rules that distinguish criticism from prohibited conduct.
- F-71: Members shall be able to report posts and contributions with a reason.
- F-72: Moderators shall be able to hide rule-breaking content and restrict account participation.
- F-73: Moderation actions shall record the actor, time, affected item or account, and reason.
- F-74: Hidden content shall leave a visible moderation notice without exposing the removed text.
- F-75: Affected members shall receive the reason for moderation and a way to request review.
- F-76: Private report details and restricted content shall be visible only to authorized reviewers.
- F-77: Negative sentiment alone shall not justify hiding content or restricting an account.

## Presentation and accessibility

- U-01: Feedback pages shall present the original experience, summary, team response, and discussion in that order.
- U-02: The interface shall use the approved dark visual direction with restrained gold accents and a distinct team-response treatment.
- U-03: Primary actions shall include experience confirmation, following updates, and adding a perspective.
- U-04: The interface shall work on desktop and mobile screens without horizontal scrolling for ordinary content.
- U-05: All primary actions shall be usable with a keyboard.
- U-06: Interactive controls shall expose accessible names and visible focus indicators.
- U-07: Text and controls shall meet WCAG 2.2 AA contrast requirements.
- U-08: Statuses and contribution types shall be identifiable without relying on color alone.
- U-09: Forms shall identify invalid fields and preserve entered content after validation errors.

## Technical and operational requirements

- T-01: The platform source shall be publicly available under an open-source license.
- T-02: The project shall document installation, configuration, operation, backup, and restoration.
- T-03: Independent communities shall be able to operate separate installations with their own branding and data.
- T-04: Authorization shall be enforced for every protected read and write operation.
- T-05: User content shall be validated and rendered without executing embedded active content.
- T-06: Account sessions and credentials shall be protected against unauthorized access.
- T-07: Data transmitted between users and the platform shall be encrypted.
- T-08: Posting, reporting, and confirmation actions shall have configurable rate limits.
- T-09: Repeated submission of the same action shall not create duplicate posts, confirmations, or notifications.
- T-10: Concurrent edits shall detect conflicts before overwriting another user's changes.
- T-11: Posts, contributions, revisions, statuses, follows, and moderation records shall persist across service restarts.
- T-12: Long feedback lists and discussions shall load in bounded pages or batches.
- T-13: Operational errors shall be recorded without exposing credentials or private report content.
- T-14: Operators shall be able to back up and restore content, account records, configuration, and history.
- T-15: A documented restoration check shall verify that backups can recover a working installation.
- T-16: The platform shall support export of feedback, contributions, summaries, statuses, and their relationships.
- T-17: The platform shall document account deletion, content attribution, and data-retention behavior.
- T-18: Public revision history shall not expose content subsequently restricted by moderation.
- T-19: Private account information shall not appear in public profiles, contributions, or public exports.
