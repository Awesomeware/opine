# Local release acceptance

Recorded **2026-11-21** for application revision `10b5b91`. This completes the local scope of [TODO #9](TODO.md#9-verify-release-acceptance). Final deployed checks and the operator retention process remain in [#10](TODO.md#10-complete-final-deployment-and-retention-checks); a license is still required before publishing the repository.

## Environment and validation

Node 26.7.0, pnpm 12.21.0, Nuxt 4.6.4, PostgreSQL 18, Playwright Chromium. Production and Storybook builds ran from an isolated source copy with separate dependencies/output, preserving the running development server. Database tests used disposable containers through the existing suite runner, never the development database.

| Check                                                     | Result                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `pnpm lint`, `pnpm format:check`, `git diff --check`      | Passed                                                         |
| `pnpm typecheck`, `pnpm storybook:typecheck`              | Passed                                                         |
| `pnpm test`                                               | 27 passed                                                      |
| `pnpm test:integration`                                   | 55 passed across database, authentication and feedback suites  |
| `pnpm build` and E2E suite runner (`pnpm test:e2e` steps) | 46 passed (45 application journeys and 1 restart verification) |
| `pnpm test:ui`                                            | 14 passed against the built Storybook catalog                  |
| `pnpm db:check`                                           | Passed                                                         |

## Pilot walkthrough evidence

The [pilot walkthrough](../journeys.md#pilot-walkthrough) was exercised through the production-build browser journeys and database assertions below. Authenticated browser users have real database sessions created by isolated fixtures. Discord callback integration uses controlled provider responses; this does **not** verify real Discord consent on deployed HTTPS.

| Acceptance behavior                                                           | Evidence                                                                                                                                                                                 |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Find, submit and share feedback; reload sessions and sign out                 | [Feedback journeys](../layers/feedback/tests/posts/feedback.e2e.ts), [authentication journeys](../layers/auth/tests/auth.e2e.ts)                                                         |
| Choose contribution types, filter discussions, retain direct links and react  | [Contribution journeys](../layers/feedback/tests/discussion/contribution-types.e2e.ts), [participation journeys](../layers/feedback/tests/discussion/participation.e2e.ts)               |
| CM queue, acknowledgement, explicit official response and outcome explanation | [Queue journeys](../layers/feedback/tests/review/queue.e2e.ts), [outcome journeys](../layers/feedback/tests/review/outcomes.e2e.ts)                                                      |
| Follow, receive/read notifications, identify member follow-up                 | Outcome journeys and [subscription integration](../layers/feedback/server/subscriptions/subscriptions.integration.ts)                                                                    |
| Lock, reject changes, keep following available, unlock and archive            | Outcome journeys and [outcome integration](../layers/feedback/server/review/outcomes.integration.ts); archive checks include hidden child reads, queues and alerts with retained records |
| Configured header, community link and safe Markdown rules                     | [Application smoke journeys](../tests/e2e/smoke.e2e.ts)                                                                                                                                  |
| Content, sessions, roles, moderation and inbox survive restart                | [Restart journey](../layers/feedback/tests/persistence.e2e.ts), same suite database restarted with a fresh application process                                                           |
| Backup restores records, configuration and a usable installation              | [Restoration evidence](deployment.md#restoration-evidence), plus the backup integration check rerun in this validation set                                                               |

## Accessibility findings and resolution

The implementation now follows the durable [UI accessibility conventions](ui.md#accessibility). Changes include document language and focusable main landmarks; SPA and skip-link focus; editor, moderation, sign-out and removed-row focus; required contribution choices with associated help/errors; meaningful heading levels; disclosure state; and concise loading/result announcements. Existing native controls and visible status text remain the foundation. No accessibility framework or project dependency was added.

[Application accessibility journeys](../tests/e2e/accessibility.e2e.ts) cover landmarks, keyboard navigation, validation descriptions and retained input, editor focus, filtered edits, native contribution choices, reaction/filter state, manager disclosures, lock/unlock and archive confirmation at 320px width. Existing feature and [Storybook tests](../.storybook/tests/components.ui.ts) additionally cover pagination, tags, native control keyboard behavior, status labels, official-response contrast and narrow layouts. Desktop and narrow rendered screenshots were inspected for readable wrapping and separation of proposal, official response and discussion.

A supplementary **axe-core 4.14.1** audit injected the pinned scanner into the built application from a temporary directory. It checked WCAG 2 A/AA, 2.1 A/AA, 2.2 AA and best-practice tags across 17 states: anonymous list, rules, sign-in and submission; invalid submission; member detail, post editor, invalid contribution and selected contribution type; populated inbox; CM detail, expanded publication/category forms, archive confirmation, locked desktop and locked narrow views; review queue and admin tags.

The scanner reported no incomplete checks and one repeated finding: `label-content-name-mismatch` on the brand link. Manual visual review treats this as a scanner limitation: the visible **O** is SVG, followed by literal **pine**, together reading **Opine**; the accessible name is **Opine home**. There is no blanket logo exemption. The [W3C label-in-name rule](https://www.w3.org/WAI/standards-guidelines/act/rules/2ee8b8/proposed/) explains the limitation of comparing visible inner text when images contribute to the label. The meaningful accessible name and approved wordmark were retained; all other audited checks passed.

Measured shared color pairs met the relevant contrast thresholds (ratios below rounded down):

| Rendered token pair                                      | Contrast         |
| -------------------------------------------------------- | ---------------- |
| Body text / page                                         | 15.73:1          |
| Muted text / page or panel                               | At least 7.77:1  |
| Error text / panel                                       | 10.13:1          |
| Control text / control                                   | 14.86:1          |
| Control border / control or page                         | At least 4.22:1  |
| Primary action text / darker action color                | 8.33:1           |
| Status badges and official text / respective backgrounds | At least 8.77:1  |
| Focus outline / page or panel                            | At least 11.32:1 |

These are scoped local results, not a WCAG certification. Keyboard tests, DOM/accessible-name assertions, rendered audits and visual inspection do not replace hands-on testing with screen readers or voice-control software. Those assistive-technology combinations were not exercised here. Repeat the relevant checks when changing controls, navigation, theme tokens or installation rules; the real deployment checks in #10 still gate a public pilot.
